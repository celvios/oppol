@echo off
echo Calling API to update user balance...
echo.

curl -X POST https://oppol-dug5.onrender.com/api/admin/update-balance ^
  -H "Content-Type: application/json" ^
  -d "{\"walletAddress\":\"0x93Edd0429c6Ac4B3644A174Ade5E9d4412E43680\",\"custodialWallet\":\"0xe3Eb84D7e271A5C44B27578547f69C80c497355B\",\"balance\":\"1.992216439902026248\"}"

echo.
echo Done!