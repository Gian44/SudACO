# PowerShell script to set Vercel environment variables
# Prerequisites: Install Vercel CLI first: npm i -g vercel

Write-Host "Setting Vercel Environment Variables..." -ForegroundColor Green
Write-Host ""

# Check if vercel CLI is available
Write-Host "Checking Vercel CLI..." -ForegroundColor Cyan
$vercelCheck = & npx vercel --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Vercel CLI found: $vercelCheck" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Vercel CLI not found. Installing..." -ForegroundColor Yellow
    npm i -g vercel
    Write-Host "[OK] Vercel CLI installed" -ForegroundColor Green
}

# Check if logged in
Write-Host "Checking Vercel login..." -ForegroundColor Cyan
$loginCheck = & npx vercel whoami 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Logged in to Vercel" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Not logged in. Please run: npx vercel login" -ForegroundColor Red
    Write-Host "   Then run this script again." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Setting KV_REST_API_URL..." -ForegroundColor Cyan
"https://charmed-javelin-7636.upstash.io" | & npx vercel env add KV_REST_API_URL production

Write-Host ""
Write-Host "Setting KV_REST_API_TOKEN..." -ForegroundColor Cyan
"AR3UAAImcDIxNGU3NDQwMDQwMjc0N2RkYjZlM2IxOWIzZDQzZThhZnAyNzYzNg" | & npx vercel env add KV_REST_API_TOKEN production

Write-Host ""
Write-Host "[OK] Environment variables set!" -ForegroundColor Green
Write-Host ""
Write-Host "[INFO] Important: Redeploy your project for changes to take effect:" -ForegroundColor Yellow
Write-Host "   npx vercel --prod" -ForegroundColor Cyan
Write-Host "   or push a new commit to trigger automatic deployment" -ForegroundColor Cyan
