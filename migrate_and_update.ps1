Write-Host "Step 1: Running database migration..." -ForegroundColor Yellow

try {
    $migrationResponse = Invoke-RestMethod -Uri "https://oppol-dug5.onrender.com/api/admin/migrate" -Method POST -ContentType "application/json"
    Write-Host "✅ Migration completed!" -ForegroundColor Green
    Write-Host ($migrationResponse | ConvertTo-Json -Depth 3)
} catch {
    Write-Host "⚠️ Migration failed (might already exist): $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "`nStep 2: Updating user balance..." -ForegroundColor Yellow

$body = @{
    walletAddress = "0x93Edd0429c6Ac4B3644A174Ade5E9d4412E43680"
    custodialWallet = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B"
    balance = "1.992216439902026248"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "https://oppol-dug5.onrender.com/api/admin/update-balance" -Method POST -Body $body -ContentType "application/json"
    Write-Host "✅ SUCCESS!" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 3)
    Write-Host "✅ User credited with 1.992216439902026248 USDC" -ForegroundColor Green
} catch {
    Write-Host "❌ ERROR!" -ForegroundColor Red
    Write-Host "Status: $($_.Exception.Response.StatusCode)"
    Write-Host "Message: $($_.Exception.Message)"
}