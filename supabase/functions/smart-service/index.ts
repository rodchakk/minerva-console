import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
const EXPO_CHUNK_SIZE = 100
const EXPO_REQUEST_TIMEOUT_MS = 8_000
const DEFAULT_QUEUE_LIMIT = 5
const MAX_QUEUE_LIMIT = 5
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface ServiceTable {
  Row: Record<string, unknown>
  Insert: Record<string, unknown>
  Update: Record<string, unknown>
  Relationships: []
}

interface ServiceDatabase {
  public: {
    Tables: Record<string, ServiceTable>
    Views: Record<string, never>
    Functions: Record<string, { Args: Record<string, unknown>; Returns: unknown }>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

type ServiceClient = SupabaseClient<ServiceDatabase>
type AudienceType = 'PUBLIC' | 'PRIVATE'

interface ExpoMessage {
  to: string
  title: string
  body: string
  data: Record<string, string>
  sound: 'default'
}

interface ExpoTicket {
  status: 'ok' | 'error' | 'unknown'
  id: string | null
  errorCode: string | null
}

interface ExpoChunkResult {
  accepted: number
  rejected: number
  unknown: number
  tickets: ExpoTicket[]
  providerResponseStatus: number | null
}

interface QueueRowRaw {
  queue_id?: unknown
  message_id?: unknown
  community_id?: unknown
  push_title?: unknown
  push_body?: unknown
  attempts?: unknown
  audience_type?: unknown
  target_user_id?: unknown
  claim_token?: unknown
  delivery_stage?: unknown
}

interface QueueRow {
  queue_id: string
  message_id: string
  community_id: string
  push_title: string
  push_body: string
  attempts: number
  audience_type: AudienceType
  target_user_id: string | null
  claim_token: string
  delivery_stage: 'PRE_PROVIDER'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

function normalizeRow(raw: QueueRowRaw): QueueRow | null {
  if (
    !isUuid(raw.queue_id) ||
    !isUuid(raw.message_id) ||
    !isUuid(raw.community_id) ||
    !isUuid(raw.claim_token) ||
    typeof raw.push_title !== 'string' ||
    typeof raw.push_body !== 'string' ||
    typeof raw.attempts !== 'number' ||
    !Number.isInteger(raw.attempts) ||
    raw.delivery_stage !== 'PRE_PROVIDER' ||
    (raw.audience_type !== 'PUBLIC' && raw.audience_type !== 'PRIVATE')
  ) return null

  if (raw.audience_type === 'PUBLIC' && raw.target_user_id !== null) return null
  if (raw.audience_type === 'PRIVATE' && !isUuid(raw.target_user_id)) return null

  const targetUserId = raw.audience_type === 'PRIVATE' && isUuid(raw.target_user_id)
    ? raw.target_user_id
    : null

  return {
    queue_id: raw.queue_id,
    message_id: raw.message_id,
    community_id: raw.community_id,
    push_title: raw.push_title,
    push_body: raw.push_body,
    attempts: raw.attempts,
    audience_type: raw.audience_type,
    target_user_id: targetUserId,
    claim_token: raw.claim_token,
    delivery_stage: raw.delivery_stage,
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

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function logEvent(
  serviceClient: ServiceClient,
  severity: 'INFO' | 'WARN' | 'ERROR',
  eventType: string,
  message: string,
  details: Record<string, unknown>,
  communityId: string | null = null,
  entityId: string | null = null,
): Promise<void> {
  try {
    await serviceClient.from('system_event_log').insert({
      severity,
      module: 'community_message_push',
      event_type: eventType,
      message,
      details,
      community_id: communityId,
      entity_type: entityId ? 'community_message_push_queue' : null,
      entity_id: entityId,
      source: 'smart-service',
    })
  } catch {
    // observability must never block notification processing
  }
}

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
    // observability must never block notification processing
  }
}

function normalizeTokens(rows: Array<{ expo_push_token: unknown }> | null): string[] {
  return [...new Set(
    (rows ?? [])
      .map((row) => typeof row.expo_push_token === 'string' ? row.expo_push_token : '')
      .filter((token) => isValidExpoPushToken(token)),
  )]
}

async function getRecipientTokens(
  serviceClient: ServiceClient,
  row: QueueRow,
): Promise<{ tokens: string[]; invalidPrivateAudience: boolean }> {
  if (row.audience_type === 'PRIVATE') {
    const targetUserId = row.target_user_id
    if (!targetUserId) return { tokens: [], invalidPrivateAudience: true }

    const { data: membership, error: membershipError } = await serviceClient
      .from('community_members')
      .select('user_id')
      .eq('community_id', row.community_id)
      .eq('user_id', targetUserId)
      .eq('is_active', true)
      .limit(1)

    if (membershipError) throw new Error(`Failed validating private audience: ${membershipError.message}`)
    if (!Array.isArray(membership) || membership.length !== 1) {
      return { tokens: [], invalidPrivateAudience: true }
    }

    const { data: tokens, error } = await serviceClient
      .from('user_push_tokens')
      .select('expo_push_token')
      .eq('user_id', targetUserId)
      .eq('community_id', row.community_id)
      .eq('is_active', true)
      .not('expo_push_token', 'is', null)

    if (error) throw new Error(`Failed loading tokens for private audience: ${error.message}`)
    return { tokens: normalizeTokens(tokens), invalidPrivateAudience: false }
  }

  const { data: members, error: membersError } = await serviceClient
    .from('community_members')
    .select('user_id')
    .eq('community_id', row.community_id)
    .eq('is_active', true)
    .in('role', ['ADMIN', 'RESIDENT'])

  if (membersError) throw new Error(`Failed loading public audience: ${membersError.message}`)
  const userIds = [...new Set(
    (members ?? [])
      .map((member) => typeof member.user_id === 'string' ? member.user_id : '')
      .filter((userId: string) => isUuid(userId)),
  )]
  if (!userIds.length) return { tokens: [], invalidPrivateAudience: false }

  const { data: tokens, error: tokensError } = await serviceClient
    .from('user_push_tokens')
    .select('expo_push_token')
    .in('user_id', userIds)
    .eq('community_id', row.community_id)
    .eq('is_active', true)
    .not('expo_push_token', 'is', null)

  if (tokensError) throw new Error(`Failed loading public audience tokens: ${tokensError.message}`)
  return { tokens: normalizeTokens(tokens), invalidPrivateAudience: false }
}

async function findPreviouslyAttemptedTokens(
  serviceClient: ServiceClient,
  row: QueueRow,
  tokens: string[],
): Promise<number> {
  const tokenHashes = await Promise.all(tokens.map((token) => sha256Hex(token)))
  const { data, error } = await serviceClient
    .from('entry_mobile_push_receipts')
    .select('token_hash')
    .eq('queue_id', row.queue_id)
    .in('token_hash', tokenHashes)
  if (error) throw new Error(`Failed checking prior provider attempts: ${error.message}`)
  return Array.isArray(data) ? data.length : 0
}

async function sendExpoChunk(messages: ExpoMessage[]): Promise<ExpoChunkResult> {
  try {
    const expoRes = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(EXPO_REQUEST_TIMEOUT_MS),
    })

    if (!expoRes.ok) {
      return { accepted: 0, rejected: 0, unknown: messages.length, tickets: [], providerResponseStatus: expoRes.status }
    }

    const expoJson: unknown = await expoRes.json().catch(() => null)
    const results = isRecord(expoJson) && Array.isArray(expoJson.data) ? expoJson.data : null
    if (!results || results.length !== messages.length) {
      return { accepted: 0, rejected: 0, unknown: messages.length, tickets: [], providerResponseStatus: expoRes.status }
    }

    const tickets: ExpoTicket[] = results.map((ticket) => {
      if (!isRecord(ticket)) return { status: 'unknown', id: null, errorCode: null }
      const details = isRecord(ticket.details) ? ticket.details : {}
      const status = ticket.status === 'ok' ? 'ok' : ticket.status === 'error' ? 'error' : 'unknown'
      return {
        status,
        id: typeof ticket.id === 'string' ? ticket.id : null,
        errorCode: typeof details.error === 'string' ? details.error.slice(0, 96) : null,
      }
    })

    return {
      accepted: tickets.filter((ticket) => ticket.status === 'ok' && ticket.id).length,
      rejected: tickets.filter((ticket) => ticket.status === 'error').length,
      unknown: tickets.filter((ticket) => ticket.status === 'unknown' || (ticket.status === 'ok' && !ticket.id)).length,
      tickets,
      providerResponseStatus: expoRes.status,
    }
  } catch {
    return { accepted: 0, rejected: 0, unknown: messages.length, tickets: [], providerResponseStatus: null }
  }
}

async function recordAcceptedTickets(
  serviceClient: ServiceClient,
  row: QueueRow,
  tokens: string[],
  tickets: ExpoTicket[],
): Promise<void> {
  const inserts: Array<Record<string, unknown>> = []
  for (let index = 0; index < tickets.length && index < tokens.length; index += 1) {
    const ticket = tickets[index]
    if (ticket.status !== 'ok' || !ticket.id) continue
    inserts.push({
      queue_id: row.queue_id,
      community_id: row.community_id,
      ticket_id: ticket.id,
      token_hash: await sha256Hex(tokens[index]),
      status: 'accepted',
    })
  }
  if (!inserts.length) return

  const { error } = await serviceClient
    .from('entry_mobile_push_receipts')
    .upsert(inserts, { onConflict: 'queue_id,token_hash', ignoreDuplicates: true })
  if (error) throw new Error(`Provider receipt persistence failed: ${error.message}`)
}

async function retryPreProvider(
  serviceClient: ServiceClient,
  row: QueueRow,
  failureCode: string,
  error: string,
): Promise<'retry_scheduled' | 'failed'> {
  const result = await serviceClient.rpc('retry_community_message_push_pre_provider_v2', {
    p_queue_id: row.queue_id,
    p_claim_token: row.claim_token,
    p_failure_code: failureCode,
    p_error: error,
  })
  if (result.error) throw new Error(`Pre-provider retry transition failed: ${result.error.message}`)
  return isRecord(result.data) && result.data.outcome === 'retry_scheduled'
    ? 'retry_scheduled'
    : 'failed'
}

async function failClaim(
  serviceClient: ServiceClient,
  row: QueueRow,
  failureCode: string,
  error: string,
  providerResponse: Record<string, unknown> | null = null,
  unknownOutcome = false,
): Promise<void> {
  const result = await serviceClient.rpc('fail_community_message_push_v2', {
    p_queue_id: row.queue_id,
    p_claim_token: row.claim_token,
    p_failure_code: failureCode,
    p_error: error,
    p_provider_response: providerResponse,
    p_unknown_outcome: unknownOutcome,
  })
  if (result.error) throw new Error(`Claim failure transition failed: ${result.error.message}`)
}

Deno.serve(async (req: Request) => {
  const invocationId = crypto.randomUUID()
  let serviceClient: ServiceClient | null = null

  try {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
    const authHeader = req.headers.get('Authorization')
    const expectedSecret = getRequiredEnv('INTERNAL_QUEUE_SECRET')
    if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) return json({ error: 'Unauthorized' }, 401)

    serviceClient = createClient<ServiceDatabase>(
      getRequiredEnv('SUPABASE_URL'),
      getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    )
    const body = await req.json().catch(() => ({}))
    const requestedLimit = Number(body?.limit ?? DEFAULT_QUEUE_LIMIT)
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(Math.trunc(requestedLimit), MAX_QUEUE_LIMIT))
      : DEFAULT_QUEUE_LIMIT

    const { data: claimedRows, error: claimError } = await serviceClient.rpc(
      'claim_pending_community_message_pushes_v2',
      { p_limit: limit },
    )
    if (claimError) {
      await logEvent(serviceClient, 'ERROR', 'PUSH_CLAIM_RPC_ERROR', 'Failed claiming queue rows', {
        status: 'failed', error_code: 'PUSH_CLAIM_RPC_ERROR',
      })
      await recordWorkerCycle(serviceClient, {
        success: false, claimed: 0, processed: 0, invocationId,
        errorCode: 'PUSH_CLAIM_RPC_ERROR', errorSummary: claimError.message,
      })
      return json({ ok: false, error: 'Push queue claim failed' }, 500)
    }

    const rawRows: QueueRowRaw[] = Array.isArray(claimedRows) ? claimedRows : []
    const rows = rawRows.map(normalizeRow)
    const invalidCount = rows.filter((row) => row === null).length
    if (invalidCount > 0) {
      const validRows = rows.filter((row): row is QueueRow => row !== null)
      await Promise.allSettled(validRows.map((row) => retryPreProvider(
        serviceClient!, row, 'INVALID_CLAIM_BATCH', 'Claim batch contained an invalid audience contract',
      )))
      await logEvent(serviceClient, 'ERROR', 'PUSH_CLAIM_ROW_INVALID_V2', 'Claim batch violated the v2 contract', {
        status: 'failed', error_code: 'PUSH_CLAIM_ROW_INVALID_V2',
        invalid_rows: invalidCount, claimed_rows: rawRows.length,
      })
      await recordWorkerCycle(serviceClient, {
        success: false, claimed: rawRows.length, processed: 0, invocationId,
        errorCode: 'PUSH_CLAIM_ROW_INVALID_V2', errorSummary: 'Claim batch contained invalid audience data',
      })
      return json({ ok: false, error: 'Invalid push claim contract' }, 500)
    }

    const validRows = rows as QueueRow[]
    if (!validRows.length) {
      await recordWorkerCycle(serviceClient, { success: true, claimed: 0, processed: 0, invocationId })
      return json({ ok: true, claimed: 0, processed: 0, summary: [] }, 200)
    }

    const summary: Array<Record<string, unknown>> = []
    for (const row of validRows) {
      let providerContacted = false
      try {
        const audience = await getRecipientTokens(serviceClient, row)
        if (audience.invalidPrivateAudience) {
          await failClaim(serviceClient, row, 'INVALID_PRIVATE_AUDIENCE',
            'Private notification target is not an active member of the claimed community')
          summary.push({ queue_id: row.queue_id, status: 'failed_invalid_audience' })
          continue
        }
        if (!audience.tokens.length) {
          await failClaim(serviceClient, row, 'NO_ACTIVE_TOKENS', 'No active push tokens found for the explicit audience')
          summary.push({ queue_id: row.queue_id, status: 'failed_no_tokens' })
          continue
        }

        const previousAttempts = await findPreviouslyAttemptedTokens(serviceClient, row, audience.tokens)
        if (previousAttempts > 0) {
          await failClaim(serviceClient, row, 'DUPLICATE_PROVIDER_ATTEMPT_BLOCKED',
            'A provider receipt already exists for this queue and audience')
          summary.push({ queue_id: row.queue_id, status: 'failed_duplicate_blocked' })
          continue
        }

        const contact = await serviceClient.rpc('mark_community_message_push_provider_contacted_v2', {
          p_queue_id: row.queue_id, p_claim_token: row.claim_token,
        })
        if (contact.error) throw new Error(`Provider-contact transition failed: ${contact.error.message}`)
        providerContacted = true

        let totalAccepted = 0
        let totalRejected = 0
        let totalUnknown = 0
        const providerStatuses: number[] = []
        for (let offset = 0; offset < audience.tokens.length; offset += EXPO_CHUNK_SIZE) {
          const chunk = audience.tokens.slice(offset, offset + EXPO_CHUNK_SIZE)
          const messages: ExpoMessage[] = chunk.map((token) => ({
            to: token, title: row.push_title, body: row.push_body, sound: 'default',
            data: { type: 'community_message', messageId: row.message_id, communityId: row.community_id },
          }))
          const result = await sendExpoChunk(messages)
          totalAccepted += result.accepted
          totalRejected += result.rejected
          totalUnknown += result.unknown
          if (result.providerResponseStatus !== null) providerStatuses.push(result.providerResponseStatus)
          await recordAcceptedTickets(serviceClient, row, chunk, result.tickets)
          if (result.unknown > 0) break
        }

        const providerResponse = {
          provider: 'expo', accepted: totalAccepted, rejected: totalRejected, unknown: totalUnknown,
          provider_statuses: [...new Set(providerStatuses)], receipt_tracking: totalAccepted > 0,
        }
        if (totalUnknown > 0) {
          await failClaim(serviceClient, row, 'EXPO_OUTCOME_UNKNOWN',
            'Expo outcome is incomplete or ambiguous; automatic retry is forbidden', providerResponse, true)
          summary.push({ queue_id: row.queue_id, status: 'unknown_outcome' })
        } else if (totalAccepted === audience.tokens.length && totalRejected === 0) {
          const complete = await serviceClient.rpc('complete_community_message_push_v2', {
            p_queue_id: row.queue_id, p_claim_token: row.claim_token, p_provider_response: providerResponse,
          })
          if (complete.error) throw new Error(`Completion transition failed: ${complete.error.message}`)
          summary.push({ queue_id: row.queue_id, status: 'confirmed', accepted: totalAccepted })
        } else {
          await failClaim(serviceClient, row,
            totalAccepted > 0 ? 'EXPO_PARTIAL_ACCEPTANCE' : 'EXPO_REJECTED',
            'Expo returned a terminal rejection for one or more audience tokens', providerResponse)
          summary.push({
            queue_id: row.queue_id,
            status: totalAccepted > 0 ? 'failed_partial' : 'failed_rejected',
            accepted: totalAccepted, rejected: totalRejected,
          })
        }
      } catch (error) {
        const errorSummary = error instanceof Error ? error.message : 'Push row processing failed'
        let preProviderOutcome: 'retry_scheduled' | 'failed' = 'failed'
        try {
          if (providerContacted) {
            await failClaim(serviceClient, row, 'POST_CONTACT_PROCESSING_ERROR',
              'Processing failed after the provider-contact boundary; automatic retry is forbidden', null, true)
          } else {
            preProviderOutcome = await retryPreProvider(serviceClient, row, 'PRE_PROVIDER_PROCESSING_ERROR',
              'Processing failed before provider contact')
          }
        } catch (transitionError) {
          await logEvent(serviceClient, 'ERROR', 'PUSH_STATE_TRANSITION_FAILED', 'Queue state transition failed', {
            status: 'failed', error_code: 'PUSH_STATE_TRANSITION_FAILED', provider_contacted: providerContacted,
            transition_error: transitionError instanceof Error ? transitionError.message : 'Unknown transition error',
          }, row.community_id, row.queue_id)
        }
        await logEvent(serviceClient, 'ERROR', 'PUSH_ROW_PROCESSING_FAILED', 'Mobile push row processing failed', {
          status: 'failed', error_code: 'PUSH_ROW_PROCESSING_FAILED', provider_contacted: providerContacted,
          error_summary: errorSummary.slice(0, 200),
        }, row.community_id, row.queue_id)
        summary.push({
          queue_id: row.queue_id,
          status: providerContacted
            ? 'unknown_outcome'
            : preProviderOutcome === 'retry_scheduled'
              ? 'pre_provider_retry'
              : 'failed_pre_provider',
        })
      }
    }

    await recordWorkerCycle(serviceClient, {
      success: true, claimed: validRows.length, processed: summary.length, invocationId,
    })
    return json({ ok: true, claimed: validRows.length, processed: summary.length, summary })
  } catch (fatalError) {
    if (serviceClient) {
      await recordWorkerCycle(serviceClient, {
        success: false, claimed: 0, processed: 0, invocationId,
        errorCode: 'PUSH_WORKER_FATAL_ERROR',
        errorSummary: fatalError instanceof Error ? fatalError.message : 'Push worker fatal error',
      })
      await logEvent(serviceClient, 'ERROR', 'PUSH_WORKER_FATAL_ERROR', 'Mobile push worker failed', {
        status: 'failed', error_code: 'PUSH_WORKER_FATAL_ERROR',
      })
    }
    return json({ ok: false, error: 'Push worker failed' }, 500)
  }
})
