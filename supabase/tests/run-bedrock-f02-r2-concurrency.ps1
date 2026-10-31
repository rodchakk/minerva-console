param(
  [Parameter(Mandatory = $true)]
  [string]$Database,
  [string]$Container = 'supabase_db_local-dev'
)

$ErrorActionPreference = 'Stop'

if ($Database -notmatch '^bedrock_f02_r2_[a-zA-Z0-9_]+$') {
  throw "Refusing concurrency test against non-disposable database '$Database'."
}

function Invoke-TestPsql {
  param([Parameter(Mandatory = $true)][string]$Sql)

  $output = & docker exec $Container psql -U postgres -d $Database -X -v ON_ERROR_STOP=1 -Atc $Sql 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "psql failed: $($output -join [Environment]::NewLine)"
  }
  return @($output)
}

$identity = Invoke-TestPsql -Sql "select current_database() || '|' || current_setting('server_version');"
if (($identity | Select-Object -Last 1) -notmatch "^$([regex]::Escape($Database))\|17\.") {
  throw "Expected an explicitly named local PostgreSQL 17 database; got '$($identity -join ' ')'."
}

$existingPending = [int]((Invoke-TestPsql -Sql "select count(*) from public.community_message_push_queue where status='pending';") | Select-Object -Last 1)
if ($existingPending -ne 0) {
  throw "Concurrency fixture requires zero pre-existing pending rows; found $existingPending."
}

$communityId = [guid]::NewGuid().ToString()
$messageId = [guid]::NewGuid().ToString()
$queueId = [guid]::NewGuid().ToString()
$lockKey = 741025

Invoke-TestPsql -Sql @"
insert into public.communities(id) values ('$communityId');
insert into public.community_messages(id, community_id) values ('$messageId', '$communityId');
insert into public.community_message_push_queue(id, message_id, community_id) values ('$queueId', '$messageId', '$communityId');
"@ | Out-Null

$sessionASql = @"
begin;
select count(*) from public.claim_pending_community_message_pushes_v2(1);
select pg_advisory_lock($lockKey);
select pg_sleep(4);
select pg_advisory_unlock($lockKey);
commit;
"@

$sessionA = $null

try {
  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = 'docker'
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  foreach ($argument in @(
    'exec', $Container, 'psql', '-U', 'postgres', '-d', $Database,
    '-X', '-v', 'ON_ERROR_STOP=1', '-Atc', $sessionASql
  )) {
    $startInfo.ArgumentList.Add($argument)
  }
  $sessionA = [System.Diagnostics.Process]::new()
  $sessionA.StartInfo = $startInfo
  if (-not $sessionA.Start()) {
    throw 'Failed to start worker A.'
  }

  $lockObserved = $false
  for ($attempt = 0; $attempt -lt 40; $attempt++) {
    $lockCount = [int]((Invoke-TestPsql -Sql "select count(*) from pg_locks where locktype='advisory' and granted and classid=0 and objid=$lockKey;") | Select-Object -Last 1)
    if ($lockCount -gt 0) {
      $lockObserved = $true
      break
    }
    Start-Sleep -Milliseconds 100
  }
  if (-not $lockObserved) {
    throw 'Worker A did not reach the post-claim handshake.'
  }

  $secondCount = [int]((Invoke-TestPsql -Sql "select count(*) from public.claim_pending_community_message_pushes_v2(1);") | Select-Object -Last 1)
  if ($secondCount -ne 0) {
    throw "Worker B duplicated a locked claim; returned $secondCount row(s)."
  }

  if (-not $sessionA.WaitForExit(15000)) {
    Stop-Process -Id $sessionA.Id -Force
    throw 'Worker A did not finish within 15 seconds.'
  }
  if ($sessionA.ExitCode -ne 0) {
    $stderr = $sessionA.StandardError.ReadToEnd()
    throw "Worker A failed: $stderr"
  }

  $finalState = (Invoke-TestPsql -Sql "select status || '|' || attempts || '|' || claim_protocol || '|' || (claim_token is not null)::text from public.community_message_push_queue where id='$queueId';") | Select-Object -Last 1
  if ($finalState -ne 'processing|1|V2|true') {
    throw "Unexpected final claim state '$finalState'."
  }

  Write-Output 'PASS: two concurrent workers produced one V2 lease and one attempt.'
}
finally {
  if ($sessionA -and -not $sessionA.HasExited) {
    Stop-Process -Id $sessionA.Id -Force -ErrorAction SilentlyContinue
  }
}
