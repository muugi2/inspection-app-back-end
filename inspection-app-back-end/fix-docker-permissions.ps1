# PowerShell script to fix folder permissions for Docker volume mount

Write-Host "=== Fixing Docker Volume Permissions ===" -ForegroundColor Green
Write-Host ""

$ftpDataPath = "C:\ftp_data"

# Check if folder exists
if (-not (Test-Path $ftpDataPath)) {
    Write-Host "Creating folder: $ftpDataPath" -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $ftpDataPath -Force
}

# Set permissions
Write-Host "Setting permissions for: $ftpDataPath" -ForegroundColor Yellow
Write-Host ""

# Grant Full Control to Users group
try {
    $acl = Get-Acl $ftpDataPath
    $permission = "Users", "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow"
    $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule $permission
    $acl.SetAccessRule($accessRule)
    Set-Acl -Path $ftpDataPath -AclObject $acl
    Write-Host "✅ Permissions set successfully!" -ForegroundColor Green
} catch {
    Write-Host "❌ Error setting permissions: $_" -ForegroundColor Red
    Write-Host "Please run PowerShell as Administrator" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Current permissions:" -ForegroundColor Cyan
icacls $ftpDataPath

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Green
Write-Host "Now restart Docker containers:" -ForegroundColor Yellow
Write-Host "  docker-compose restart backend" -ForegroundColor White

