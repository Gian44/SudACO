# Complete setup script for Vercel environment variables
# This script will guide you through the entire process

Write-Host "🚀 Vercel Environment Variables Setup" -ForegroundColor Green
Write-Host ""

# Step 1: Check Vercel CLI
Write-Host "Step 1: Checking Vercel CLI..." -ForegroundColor Cyan
try {
    $vercelVersion = npx vercel --version 2>&1
    Write-Host "✓ Vercel CLI found: $vercelVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Vercel CLI not found. Installing..." -ForegroundColor Yellow
    npm i -g vercel
    Write-Host "✓ Vercel CLI installed" -ForegroundColor Green
}

Write-Host ""

# Step 2: Check login
Write-Host "Step 2: Checking Vercel login..." -ForegroundColor Cyan
try {
    $whoami = npx vercel whoami 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Logged in as: $whoami" -ForegroundColor Green
    } else {
        throw "Not logged in"
    }
} catch {
    Write-Host "⚠️  Not logged in. Please complete login:" -ForegroundColor Yellow
    Write-Host "   Run: npx vercel login" -ForegroundColor Cyan
    Write-Host "   Then run this script again." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Starting login process..." -ForegroundColor Yellow
    npx vercel login
    Write-Host ""
    Write-Host "Please complete the login in your browser, then press Enter to continue..." -ForegroundColor Yellow
    Read-Host "Press Enter after completing login"
}

Write-Host ""

# Step 3: Link project
Write-Host "Step 3: Linking project..." -ForegroundColor Cyan
if (-not (Test-Path ".vercel/project.json")) {
    Write-Host "⚠️  Project not linked. Starting link process..." -ForegroundColor Yellow
    Write-Host "   Follow the prompts to link your project" -ForegroundColor Cyan
    npx vercel link
} else {
    Write-Host "✓ Project already linked" -ForegroundColor Green
}

Write-Host ""

# Step 4: Set environment variables
Write-Host "Step 4: Setting environment variables..." -ForegroundColor Cyan
Write-Host ""

Write-Host "Setting KV_REST_API_URL..." -ForegroundColor Yellow
"https://charmed-javelin-7636.upstash.io" | npx vercel env add KV_REST_API_URL production

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ KV_REST_API_URL set" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to set KV_REST_API_URL" -ForegroundColor Red
}

Write-Host ""
Write-Host "Setting KV_REST_API_TOKEN..." -ForegroundColor Yellow
"AR3UAAImcDIxNGU3NDQwMDQwMjc0N2RkYjZlM2IxOWIzZDQzZThhZnAyNzYzNg" | npx vercel env add KV_REST_API_TOKEN production

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ KV_REST_API_TOKEN set" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to set KV_REST_API_TOKEN" -ForegroundColor Red
}

Write-Host ""
Write-Host "✅ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  Important: Redeploy your project for changes to take effect:" -ForegroundColor Yellow
Write-Host "   npx vercel --prod" -ForegroundColor Cyan
Write-Host "   or push a new commit to trigger automatic deployment" -ForegroundColor Cyan
