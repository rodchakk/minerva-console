param(
  [string]$Database = "bedrock_f03_r2_20261031",
  [string]$HostName = "127.0.0.1",
  [int]$Port = 54322,
  [string]$UserName = "postgres"
)

$ErrorActionPreference = "Stop"
$env:PGPASSWORD = "postgres"

$communityId = "10000000-0000-4000-8000-000000000001"
$queueId = "10000000-0000-4000-8000-000000000102"
$prepareSql = @"
set test.superadmin='true';
select (value->>'activation_id') || '|' || (value->>'pin')
from jsonb_array_elements(
  public.generate_resident_activation_pins_locked_v2(
    '$communityId'::uuid,
    array['$queueId'::uuid]
  )->'items'
);
"@
$prepareSql = $prepareSql -replace "\r?\n", " "

$credentialLine = & psql -X -q -A -t -h $HostName -p $Port -U $UserName -d $Database -v ON_ERROR_STOP=1 -c $prepareSql |
  Where-Object { $_ -match '^[0-9a-f-]{36}\|[0-9]{6}$' } |
  Select-Object -Last 1
if (-not $credentialLine) { throw "Failed to prepare synthetic v2 credential" }
$credential = $credentialLine.Trim()

$parts = $credential.Split('|')
$activationId = $parts[0]
$pin = $parts[1]
$callSql = @"
select public.complete_resident_activation_pin_v2(
  '$activationId'::uuid,
  '$pin',
  'Synthetic-Concurrent-42!',
  null
)::text;
"@
$callSql = $callSql -replace "\r?\n", " "

$jobs = 1..2 | ForEach-Object {
  Start-Job -ScriptBlock {
    param($H, $P, $U, $D, $Sql)
    $env:PGPASSWORD = "postgres"
    & psql -X -q -A -t -h $H -p $P -U $U -d $D -v ON_ERROR_STOP=1 -c $Sql
  } -ArgumentList $HostName, $Port, $UserName, $Database, $callSql
}

$outputs = $jobs | Wait-Job | Receive-Job
$jobs | Remove-Job

$successes = @($outputs | Where-Object { $_ -match '"success"\s*:\s*true' }).Count
$rejections = @($outputs | Where-Object { $_ -match '"error"\s*:\s*"invalid_or_expired"' }).Count
if ($successes -ne 1 -or $rejections -ne 1) {
  throw "Expected one success and one replay rejection; got success=$successes rejection=$rejections"
}

$verifySql = @"
select
  (select count(*) from auth.users where email='concurrent@example.invalid') || '|' ||
  (select count(*) from public.resident_activation_pins
    where activation_handle='$activationId'::uuid and status='used') || '|' ||
  (select count(*) from public.resident_activation_queue
    where id='$queueId'::uuid and status='activated');
"@
$verifySql = $verifySql -replace "\r?\n", " "
$verification = (& psql -X -q -A -t -h $HostName -p $Port -U $UserName -d $Database -v ON_ERROR_STOP=1 -c $verifySql).Trim()
if ($verification -ne "1|1|1") {
  throw "Concurrent completion violated single-consumption invariant: $verification"
}

Write-Output "BEDROCK F03 concurrency passed: one success, one rejection, one identity."
