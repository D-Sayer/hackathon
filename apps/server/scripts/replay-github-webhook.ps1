param(
  [string]$Url = "http://localhost:3000/webhooks/github",
  [string]$WebhookSecret = $env:GITHUB_WEBHOOK_SECRET,
  [string]$EnvFile = "",
  [string]$Event = "pull_request",
  [string]$Action = "opened",
  [int]$PrNumber = 42,
  [string]$Title = "Add docs agent",
  [string]$Owner = "acme",
  [string]$Repo = "repo",
  [string]$BaseRef = "main",
  [string]$HeadRef = "feature/docs-agent",
  [switch]$Draft
)

$resolvedEnvFile = $EnvFile
if (-not $resolvedEnvFile) {
  $resolvedEnvFile = Join-Path -Path $PSScriptRoot -ChildPath "..\\.env"
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

$body = @{
  action = $Action
  installation = @{
    id = 123
  }
  pull_request = @{
    base = @{
      ref = $BaseRef
    }
    draft = [bool]$Draft
    head = @{
      ref = $HeadRef
    }
    html_url = "https://github.com/$Owner/$Repo/pull/$PrNumber"
    number = $PrNumber
    title = $Title
  }
  repository = @{
    default_branch = $BaseRef
    full_name = "$Owner/$Repo"
    name = $Repo
    owner = @{
      login = $Owner
    }
  }
} | ConvertTo-Json -Depth 6

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
if ($signature) {
  Write-Host "signature: present"
} else {
  Write-Host "signature: missing (looked in $resolvedEnvFile)"
}
Write-Host ""

$response = Invoke-RestMethod -Method Post -Uri $Url -Headers $headers -Body $body
$response | ConvertTo-Json -Depth 10
