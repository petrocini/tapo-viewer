$ErrorActionPreference = 'Stop'

$version = 'v1.9.14'
$expectedSha256 = 'dd4167d75cb04abe618855b7c71f8658bd009f60c1a71835d134d2c11c939907'
$projectRoot = Split-Path -Parent $PSScriptRoot
$vendorDir = Join-Path $projectRoot 'vendor'
$archive = Join-Path $vendorDir 'go2rtc_win64.zip'
$binary = Join-Path $vendorDir 'go2rtc.exe'
$url = "https://github.com/AlexxIT/go2rtc/releases/download/$version/go2rtc_win64.zip"

New-Item -ItemType Directory -Path $vendorDir -Force | Out-Null

try {
    Write-Host "Baixando go2rtc $version..."
    Invoke-WebRequest -Uri $url -OutFile $archive -UseBasicParsing
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.IO.File]::ReadAllBytes($archive)
        $actualSha256 = [System.BitConverter]::ToString($sha256.ComputeHash($bytes)).Replace('-', '').ToLowerInvariant()
    }
    finally {
        $sha256.Dispose()
    }
    if ($actualSha256 -ne $expectedSha256) {
        throw 'O arquivo baixado não corresponde ao SHA-256 do release oficial.'
    }

    Expand-Archive -LiteralPath $archive -DestinationPath $vendorDir -Force
    if (-not (Test-Path -LiteralPath $binary)) {
        throw 'O executável go2rtc.exe não foi encontrado no arquivo baixado.'
    }
    Write-Host "go2rtc instalado em $binary"
}
finally {
    if (Test-Path -LiteralPath $archive) {
        Remove-Item -LiteralPath $archive -Force
    }
}
