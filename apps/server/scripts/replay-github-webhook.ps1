param(
  [string]$Url = "http://localhost:3000/webhooks/github",
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

$headers = @{
  "Content-Type" = "application/json"
  "X-GitHub-Event" = $Event
  "X-GitHub-Delivery" = "local-replay-$([guid]::NewGuid().ToString())"
}

Write-Host "POST $Url"
Write-Host "X-GitHub-Event: $Event"
Write-Host "action: $Action"
Write-Host "pr: #$PrNumber $Title"
Write-Host ""

$response = Invoke-RestMethod -Method Post -Uri $Url -Headers $headers -Body $body
$response | ConvertTo-Json -Depth 10
