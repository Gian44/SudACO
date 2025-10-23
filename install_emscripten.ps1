# Emscripten SDK Installation Script for Windows
# This script will download and install Emscripten SDK

Write-Host "Installing Emscripten SDK..." -ForegroundColor Green

# Check if Git is installed
try {
    $gitVersion = git --version
    Write-Host "✓ Git found: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Git not found. Please install Git first from https://git-scm.com/downloads" -ForegroundColor Red
    Write-Host "After installing Git, restart PowerShell and run this script again." -ForegroundColor Yellow
    exit 1
}

# Check if Python is installed
try {
    $pythonVersion = python --version
    Write-Host "✓ Python found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Python not found. Please install Python 3.6+ first from https://www.python.org/downloads/" -ForegroundColor Red
    Write-Host "After installing Python, restart PowerShell and run this script again." -ForegroundColor Yellow
    exit 1
}

# Create directory for Emscripten SDK
$emsdkPath = "C:\emsdk"
if (Test-Path $emsdkPath) {
    Write-Host "Emscripten SDK directory already exists. Removing..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $emsdkPath
}

Write-Host "Creating Emscripten SDK directory..." -ForegroundColor Blue
New-Item -ItemType Directory -Path $emsdkPath -Force | Out-Null

# Clone emsdk repository
Write-Host "Cloning emsdk repository..." -ForegroundColor Blue
Set-Location $emsdkPath
git clone https://github.com/emscripten-core/emsdk.git .

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to clone emsdk repository" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Successfully cloned emsdk repository" -ForegroundColor Green

# Install latest Emscripten SDK
Write-Host "Installing latest Emscripten SDK (this may take several minutes)..." -ForegroundColor Blue
.\emsdk.bat install latest

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to install Emscripten SDK" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Successfully installed Emscripten SDK" -ForegroundColor Green

# Activate latest Emscripten SDK
Write-Host "Activating Emscripten SDK..." -ForegroundColor Blue
.\emsdk.bat activate latest

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to activate Emscripten SDK" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Successfully activated Emscripten SDK" -ForegroundColor Green

# Set up environment variables for current session
Write-Host "Setting up environment variables..." -ForegroundColor Blue
.\emsdk_env.bat

Write-Host "✓ Emscripten SDK installation completed!" -ForegroundColor Green
Write-Host ""
Write-Host "To use Emscripten in future PowerShell sessions, run:" -ForegroundColor Yellow
Write-Host "  C:\emsdk\emsdk_env.bat" -ForegroundColor Cyan
Write-Host ""
Write-Host "Or add this line to your PowerShell profile:" -ForegroundColor Yellow
Write-Host "  C:\emsdk\emsdk_env.bat" -ForegroundColor Cyan
Write-Host ""
Write-Host "You can now run the WASM build script!" -ForegroundColor Green
