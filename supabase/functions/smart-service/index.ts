import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
const EXPO_CHUNK_SIZE = 100

type ServiceClient = ReturnType<typeof createClient>

interface ExpoMessage {
  to: string
  title: string
  body: string
  data?: Record<string, string>
  sound: 'default'
}

// Defensive: accept either queue_id (new) or id (legacy) from the claim RPC.
// During rollout the RPC may return either shape; we normalize here so the
// worker keeps closing rows correctly across the deploy boundary.
interface QueueRowRaw {
  queue_id?: string
  id?: string
  message_id: string
  community_id: string
  push_title: string
  push_body: string
  attempts: number
  target_user_id?: string | null
}

interface QueueRow {
  queue_id: string
  message_id: string
  community_id: string
  push_title: string
  push_body: string
  attempts: number
  target_user_id: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeRow(raw: QueueRowRaw): QueueRow | null {
  const queueId = raw.queue_id ?? raw.id
  if (!queueId) return null
  return {
    queue_id: queueId,
    message_id: raw.message_id,
    community_id: raw.community_id,
    push_title: raw.push_title,
    push_body: raw.push_body,
    attempts: raw.attempts,
    target_user_id: raw.target_user_id ?? null,
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value || !value.trim()) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function isValidExpoPushToken(token: string): boolean {
  return /^ExponentPushToken\[[^\]]+\]$/.test(token) || /^ExpoPushToken\[[^\]]+\]$/.test(token)
}

async function getRecipientTokens(
  serviceClient: ServiceClient,
  communityId: string,
  targetUserId: string | null,
): Promise<string[]> {
  if (targetUserId) {
    const { data: tokens, error } = await serviceClient
      .from('user_push_tokens')
      .select('expo_push_token')
      .eq('user_id', targetUserId)
      .eq('community_id', communityId)
      .eq('is_active', true)
      .not('expo_push_token', 'is', null)

    if (error) throw new Error(`Failed loading tokens for target user: ${error.message}`)

    return [...new Set(
      (tokens ?? [])
        .map((r: { expo_push_token: string | null }) => r.expo_push_token ?? '')
        .filter((token: string) => isValidExpoPushToken(token))
    )]
  }

  const { data: members, error: membersError } = await serviceClient
    .from('community_members')
    .select('user_id')
    .eq('community_id', communityId)
    .eq('is_active', true)
    .in('role', ['ADMIN', 'RESIDENT'])

  if (membersError) throw new Error(`Failed loading community members: ${membersError.message}`)

  const userIds = [...new Set(
    (members ?? [])
      .map((m: { user_id: string | null }) => m.user_id ?? '')
      .filter(Boolean)
  )]

  if (!userIds.length) return []

  const { data: tokens, error: tokensError } = await serviceClient
    .from('user_push_tokens')
    .select('expo_push_token')
    .in('user_id', userIds)
    .eq('community_id', communityId)
    .eq('is_active', true)
    .not('expo_push_token', 'is', null)

  if (tokensError) throw new Error(`Failed loading push tokens: ${tokensError.message}`)

  return [...new Set(
    (tokens ?? [])
      .map((r: { expo_push_token: string | null }) => r.expo_push_token ?? '')
      .filter((token: string) => isValidExpoPushToken(token))
  )]
}

async function sendExpoChunk(messages: ExpoMessage[]): Promise<{
  sent: number
  failed: number
  providerResponseStatus?: number | null
  providerResponseBody?: string | null
}> {
  try {
    const expoRes = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(messages),
    })

    if (!expoRes.ok) {
      const raw = await expoRes.text()
      return { sent: 0, failed: messages.length, providerResponseStatus: expoRes.status, providerResponseBody: raw }
    }

    let expoJson: unknown
    try { expoJson = await expoRes.json() } catch {
      return { sent: 0, failed: messages.length, providerResponseStatus: expoRes.status, providerResponseBody: 'Invalid JSON' }
    }

    const results = isRecord(expoJson) && Array.isArray(expoJson.data) ? expoJson.data : null
    if (!results) return { sent: 0, failed: messages.length, providerResponseStatus: expoRes.status, providerResponseBody: JSON.stringify(expoJson) }

    let sent = 0, failed = 0
    for (const ticket of results) {
      if (isRecord(ticket) && ticket.status === 'ok') sent++
      else failed++
    }
    if (results.length < messages.length) failed += (messages.length - results.length)

    return { sent, failed, providerResponseStatus: expoRes.status, providerResponseBody: JSON.stringify(expoJson) }
  } catch (error) {
    return { sent: 0, failed: messages.length, providerResponseStatus: null, providerResponseBody: String(error) }
  }
}

// Best-effort logger to system_event_log. Never throws.
async function logEvent(
  serviceClient: ServiceClient,
  severity: 'INFO' | 'WARN' | 'ERROR',
  eventType: string,
  message: string,
  details: Record<string, unknown>,
): Promise<void> {
  try {
    await serviceClient.from('system_event_log').insert({
      severity,
      module: 'community_message_push',
      event_type: eventType,
      message,
      details,
      source: 'smart-service',
    })
  } catch {
    // swallow — logging must never block the worker
  }
}

// Durable worker health is deliberately separate from notification-delivery
// success/failure. A successful cycle only proves that the worker could claim
// and complete its loop; it does not prove Expo delivery health.
async function recordWorkerCycle(
  serviceClient: ServiceClient,
  input: {
    success: boolean
    claimed: number
    processed: number
    invocationId: string
    errorCode?: string | null
    errorSummary?: string | null
  },
): Promise<void> {
  try {
    await serviceClient.rpc('record_entry_notification_worker_cycle_v1', {
      p_success: input.success,
      p_claimed: Math.max(0, input.claimed),
      p_processed: Math.max(0, input.processed),
      p_error_code: input.errorCode ?? null,
      p_error_summary: input.errorSummary ?? null,
      p_invocation_id: input.invocationId,
    })
  } catch {
    // fail-open — observability must never block notification processing
  }
}

Deno.serve(async (req: Request) => {
  const invocationId = crypto.randomUUID()
  let serviceClient: ServiceClient | null = null

  try {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

    const authHeader = req.headers.get('Authorization')
    const expectedSecret = getRequiredEnv('INTERNAL_QUEUE_SECRET')

    if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const supabaseUrl = getRequiredEnv('SUPABASE_URL')
    const supabaseServiceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')
    serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey)

    const body = await req.json().catch(() => ({}))
    const limit = Number(body?.limit ?? 20)

    const { data: claimedRows, error: claimError } = await serviceClient.rpc(
      'claim_pending_community_message_pushes',
      { p_limit: Number.isFinite(limit) ? limit : 20 },
    )

    if (claimError) {
      await logEvent(serviceClient, 'ERROR', 'PUSH_CLAIM_RPC_ERROR', 'Failed claiming queue rows', { error: claimError.message })
      await recordWorkerCycle(serviceClient, {
        success: false,
        claimed: 0,
        processed: 0,
        invocationId,
        errorCode: 'PUSH_CLAIM_RPC_ERROR',
        errorSummary: claimError.message,
      })
      return json({ ok: false, error: `Failed claiming: ${claimError.message}` }, 500)
    }

    const rawRows: QueueRowRaw[] = Array.isArray(claimedRows) ? claimedRows : []
    const rows: QueueRow[] = []
    for (const raw of rawRows) {
      const norm = normalizeRow(raw)
      if (norm) {
        rows.push(norm)
      } else {
        await logEvent(serviceClient, 'ERROR', 'PUSH_CLAIM_ROW_MISSING_ID', 'Claim row had neither queue_id nor id', {
          has_queue_id: Boolean(raw.queue_id),
          has_id: Boolean(raw.id),
          has_message_id: Boolean(raw.message_id),
          has_community_id: Boolean(raw.community_id),
          attempts: raw.attempts,
        })
      }
    }

    if (!rows.length) {
      await recordWorkerCycle(serviceClient, {
        success: true,
        claimed: 0,
        processed: 0,
        invocationId,
      })
      return json({ ok: true, claimed: 0, processed: 0, summary: [] }, 200)
    }

    await logEvent(serviceClient, 'INFO', 'PUSH_CLAIMED', `Claimed ${rows.length} queue row(s)`, {
      claimed: rows.length,
      queue_ids: rows.map(r => r.queue_id),
    })

    const messageIds = rows.map(r => r.message_id)
    const { data: messageDetails } = await serviceClient
      .from('community_messages')
      .select('id, target_user_id')
      .in('id', messageIds)

    const targetUserMap: Record<string, string | null> = {}
    for (const msg of (messageDetails ?? [])) {
      targetUserMap[msg.id] = msg.target_user_id ?? null
    }

    const summary: Array<Record<string, unknown>> = []

    for (const row of rows) {
      try {
        const targetUserId = targetUserMap[row.message_id] ?? null
        const tokens = await getRecipientTokens(serviceClient, row.community_id, targetUserId)

        if (!tokens.length) {
          const { error: failError } = await serviceClient.rpc('fail_community_message_push', {
            p_queue_id: row.queue_id,
            p_error: 'No active push tokens found for audience',
          })
          if (failError) {
            await logEvent(serviceClient, 'ERROR', 'PUSH_FAIL_RPC_ERROR', 'fail_community_message_push errored', { queue_id: row.queue_id, error: failError.message })
          }
          summary.push({ queue_id: row.queue_id, message_id: row.message_id, status: failError ? 'fail_rpc_error' : 'failed_no_tokens', target_user_id: targetUserId })
          continue
        }

        let totalSent = 0, totalFailed = 0
        const chunkSummaries: Array<Record<string, unknown>> = []

        for (let i = 0; i < tokens.length; i += EXPO_CHUNK_SIZE) {
          const chunk = tokens.slice(i, i + EXPO_CHUNK_SIZE)
          const messages: ExpoMessage[] = chunk.map((token) => ({
            to: token,
            title: row.push_title,
            body: row.push_body,
            sound: 'default',
            data: { type: 'community_message', messageId: row.message_id, communityId: row.community_id },
          }))
          const result = await sendExpoChunk(messages)
          totalSent += result.sent
          totalFailed += result.failed
          chunkSummaries.push({ chunk_index: Math.floor(i / EXPO_CHUNK_SIZE), chunk_size: chunk.length, sent: result.sent, failed: result.failed, provider_status: result.providerResponseStatus ?? null })
        }

        if (totalSent > 0 && totalFailed === 0) {
          const { error: completeError } = await serviceClient.rpc('complete_community_message_push', { p_queue_id: row.queue_id })
          if (completeError) {
            await logEvent(serviceClient, 'ERROR', 'PUSH_COMPLETE_RPC_ERROR', 'complete_community_message_push errored', { queue_id: row.queue_id, error: completeError.message })
          }
          summary.push({ queue_id: row.queue_id, message_id: row.message_id, status: completeError ? 'complete_rpc_error' : 'sent', sent: totalSent, failed: totalFailed, target_user_id: targetUserId })
        } else {
          const { error: failError } = await serviceClient.rpc('fail_community_message_push', {
            p_queue_id: row.queue_id,
            p_error: totalSent > 0 ? `Partial. sent=${totalSent}, failed=${totalFailed}` : `Failed. sent=${totalSent}, failed=${totalFailed}`,
          })
          if (failError) {
            await logEvent(serviceClient, 'ERROR', 'PUSH_FAIL_RPC_ERROR', 'fail_community_message_push errored', { queue_id: row.queue_id, error: failError.message })
          }
          summary.push({ queue_id: row.queue_id, message_id: row.message_id, status: failError ? 'fail_rpc_error' : 'failed_delivery', sent: totalSent, failed: totalFailed, target_user_id: targetUserId })
        }
      } catch (rowError) {
        const { error: failError } = await serviceClient.rpc('fail_community_message_push', { p_queue_id: row.queue_id, p_error: String(rowError) })
        if (failError) {
          await logEvent(serviceClient, 'ERROR', 'PUSH_FAIL_RPC_ERROR', 'fail_community_message_push errored after row exception', { queue_id: row.queue_id, error: failError.message, row_error: String(rowError) })
        }
        summary.push({ queue_id: row.queue_id, message_id: row.message_id, status: 'failed_exception', error: String(rowError) })
      }
    }

    await recordWorkerCycle(serviceClient, {
      success: true,
      claimed: rows.length,
      processed: summary.length,
      invocationId,
    })

    return json({ ok: true, claimed: rows.length, processed: summary.length, summary })
  } catch (fatalError) {
    if (serviceClient) {
      await recordWorkerCycle(serviceClient, {
        success: false,
        claimed: 0,
        processed: 0,
        invocationId,
        errorCode: 'PUSH_WORKER_FATAL_ERROR',
        errorSummary: String(fatalError),
      })
    }
    return json({ ok: false, error: String(fatalError) }, 500)
  }
})
