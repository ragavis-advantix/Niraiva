<#
PowerShell script to install Chocolatey (if missing) and Tesseract OCR on Windows.
Run this as Administrator.

Usage:
  Open PowerShell as Administrator and run:
    .\install_tesseract.ps1
#>

function Is-Administrator {
    $current = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $current.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)
}

if (-not (Is-Administrator)) {
    Write-Warning "This script should be run as Administrator. Restart PowerShell 'Run as Administrator' then re-run the script."
    exit 1
}

Write-Output "Checking Chocolatey..."
if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
    Write-Output "Installing Chocolatey..."
    Set-ExecutionPolicy Bypass -Scope Process -Force
    iwr https://chocolatey.org/install.ps1 -UseBasicParsing | iex
} else {
    Write-Output "Chocolatey already installed"
}

Write-Output "Installing Tesseract OCR via Chocolatey..."
choco install -y tesseract

Write-Output "Verifying tesseract installation..."
try {
    $ver = & tesseract --version 2>&1
    Write-Output $ver
} catch {
    Write-Warning "tesseract not found in PATH. You may need to restart your shell or add the Tesseract install folder to PATH."
}
