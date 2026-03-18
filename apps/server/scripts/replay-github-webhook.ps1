param(
  [string]$Url = "http://localhost:3000/webhooks/github",
  [string]$WebhookSecret = $env:GITHUB_WEBHOOK_SECRET,
  [string]$EnvFile = "",
  [string]$FixturePath = "",
  [string]$Event = "pull_request",
  [string]$Action = "opened",
  [int]$PrNumber = 42,
  [string]$Title = "Add docs agent",
  [string]$Body = "This PR adds the first docs agent intake slice.",
  [string]$Owner = "acme",
  [string]$Repo = "repo",
  [string]$BaseRef = "main",
  [string]$HeadRef = "feature/docs-agent",
  [string]$Author = "octocat",
  [string]$Sender = "octocat",
  [switch]$Draft
)

$resolvedEnvFile = $EnvFile
if (-not $resolvedEnvFile) {
  $resolvedEnvFile = Join-Path -Path $PSScriptRoot -ChildPath "..\\.env"
}

if (-not $FixturePath) {
  $FixturePath = Join-Path -Path $PSScriptRoot -ChildPath "..\\..\\packages\\github-doc-agent\\src\\__fixtures__\\pull-request-opened.json"
}

if (-not $WebhookSecret -and (Test-Path -LiteralPath $resolvedEnvFile)) {
  $envLines = Get-Content -LiteralPath $resolvedEnvFile

  foreach ($line in $envLines) {
    if ($line -match '^\s*GITHUB_WEBHOOK_SECRET\s*=\s*(.*)\s*$') {
      $WebhookSecret = $matches[1].Trim()

      if (
        ($WebhookSecret.StartsWith('"') -and $WebhookSecret.EndsWith('"')) -or
        ($WebhookSecret.StartsWith("'") -and $WebhookSecret.EndsWith("'"))
      ) {
        $WebhookSecret = $WebhookSecret.Substring(1, $WebhookSecret.Length - 2)
      }

      break
    }
  }
}

if (-not (Test-Path -LiteralPath $FixturePath)) {
  throw "Fixture file not found: $FixturePath"
}

$payload = Get-Content -LiteralPath $FixturePath -Raw | ConvertFrom-Json
$payload.action = $Action
$payload.installation.id = 123
$payload.pull_request.base.ref = $BaseRef
$payload.pull_request.body = $Body
$payload.pull_request.draft = [bool]$Draft
$payload.pull_request.head.ref = $HeadRef
$payload.pull_request.head.repo.full_name = "$Owner/$Repo"
$payload.pull_request.html_url = "https://github.com/$Owner/$Repo/pull/$PrNumber"
$payload.pull_request.number = $PrNumber
$payload.pull_request.title = $Title
$payload.pull_request.user.login = $Author
$payload.repository.default_branch = $BaseRef
$payload.repository.full_name = "$Owner/$Repo"
$payload.repository.name = $Repo
$payload.repository.owner.login = $Owner
$payload.sender.login = $Sender

$body = $payload | ConvertTo-Json -Depth 20

$signature = $null
if ($WebhookSecret) {
  $hmac = [System.Security.Cryptography.HMACSHA256]::new([System.Text.Encoding]::UTF8.GetBytes($WebhookSecret))
  try {
    $hashBytes = $hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($body))
  } finally {
    $hmac.Dispose()
  }

  $hash = [Convert]::ToHexString($hashBytes).ToLowerInvariant()
  $signature = "sha256=$hash"
}

$headers = @{
  "Content-Type" = "application/json"
  "X-GitHub-Event" = $Event
  "X-GitHub-Delivery" = "local-replay-$([guid]::NewGuid().ToString())"
}

if ($signature) {
  $headers["X-Hub-Signature-256"] = $signature
}

Write-Host "POST $Url"
Write-Host "X-GitHub-Event: $Event"
Write-Host "action: $Action"
Write-Host "pr: #$PrNumber $Title"
Write-Host "fixture: $FixturePath"
if ($signature) {
  Write-Host "signature: present"
} else {
  Write-Host "signature: missing (looked in $resolvedEnvFile)"
}
Write-Host ""

$response = Invoke-RestMethod -Method Post -Uri $Url -Headers $headers -Body $body
$response | ConvertTo-Json -Depth 10
