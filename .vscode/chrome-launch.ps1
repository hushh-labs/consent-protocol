param (
    [string]$WorkspaceRoot
)

$ChromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$UserDataDir = Join-Path $WorkspaceRoot ".vscode\chrome-debug"

# Create directory if it doesn't exist to ensure no Chrome startup errors
if (-not (Test-Path -Path $UserDataDir)) {
    New-Item -ItemType Directory -Path $UserDataDir -Force | Out-Null
}

# Construct the argument specifically so "Start-Process" sees the quotes around the path
# Use 3 double quotes for an escaped double quote inside a string
$DebugDirArg = "--user-data-dir=""$UserDataDir"""

Start-Process -FilePath $ChromePath -ArgumentList "--remote-debugging-port=9222", $DebugDirArg, "http://localhost:3000"
