param(
    [string]$Sdk = "",
    [string]$OutDir = "",
    [string]$BuildTools = "",
    [string]$AndroidJar = ""
)

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = Split-Path -Parent $here
$workspace = Split-Path -Parent $repo

if (-not $Sdk) { $Sdk = Join-Path $workspace "_tmp\android\sdk" }
if (-not $OutDir) { $OutDir = Join-Path $workspace "submission" }
if (-not $BuildTools) { $BuildTools = Join-Path $Sdk "build-tools\34.0.0" }
if (-not $AndroidJar) { $AndroidJar = Join-Path $Sdk "platforms\android-34\android.jar" }

$jdk = "C:\Program Files\Microsoft\jdk-17.0.12.7-hotspot"
if (Test-Path $jdk) {
    $env:JAVA_HOME = $jdk
    $env:PATH = "$jdk\bin;$env:PATH"
}

$build = Join-Path $here "build"
$classes = Join-Path $build "classes"
$dex = Join-Path $build "dex"
$assets = Join-Path $here "assets\www"

if (!(Test-Path $androidJar)) { throw "android.jar not found at $androidJar" }

Remove-Item -Recurse -Force $build -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $build, $classes, $dex, $assets | Out-Null

Write-Host "Copying web build..."
Copy-Item -Recurse -Force (Join-Path $repo "dist\*") $assets

Write-Host "Inlining the CSS and JS bundles into index.html..."
$indexPath = Join-Path $assets "index.html"
$html = [System.IO.File]::ReadAllText($indexPath, [System.Text.Encoding]::UTF8)
$html = [regex]::Replace($html, '<link rel="modulepreload"[^>]*>', '')
$html = [regex]::Replace($html, '<link rel="stylesheet"[^>]*href="\./([^"]+)"[^>]*>', {
    param($m)
    $css = [System.IO.File]::ReadAllText((Join-Path $assets $m.Groups[1].Value), [System.Text.Encoding]::UTF8)
    return "<style>`n$css`n</style>"
})
$html = [regex]::Replace($html, '<script type="module"[^>]*src="\./([^"]+)"[^>]*></script>', {
    param($m)
    $js = [System.IO.File]::ReadAllText((Join-Path $assets $m.Groups[1].Value), [System.Text.Encoding]::UTF8)
    $js = $js.Replace('</script', '<\/script')
    return "<script type=`"module`">`n$js`n</script>"
})
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($indexPath, $html, $utf8NoBom)
$indexSize = (Get-Item $indexPath).Length
Write-Host "index.html is now $indexSize bytes"

Write-Host "Bundling the web build as res/raw/www.zip..."
$rawDir = Join-Path $here "res\raw"
New-Item -ItemType Directory -Force -Path $rawDir | Out-Null
$rawZip = Join-Path $rawDir "www.zip"
if (Test-Path $rawZip) { Remove-Item -Force $rawZip }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory(
    $assets, $rawZip, [System.IO.Compression.CompressionLevel]::Optimal, $false)

Push-Location $here
try {
Write-Host "Compiling resources..."
$aapt2 = Join-Path $BuildTools "aapt2.exe"
& $aapt2 compile --dir "res" -o (Join-Path $build "resources.zip")
if ($LASTEXITCODE -ne 0) { throw "aapt2 compile failed" }

& $aapt2 link `
    -o (Join-Path $build "base.apk") `
    -I $AndroidJar `
    --manifest "AndroidManifest.xml" `
    -A "assets" `
    --java (Join-Path $build "gen") `
    --min-sdk-version 23 `
    --target-sdk-version 34 `
    --version-code 11 `
    --version-name "2.0" `
    (Join-Path $build "resources.zip")
if ($LASTEXITCODE -ne 0) { throw "aapt2 link failed" }
} finally {
    Pop-Location
}

Write-Host "Compiling Java..."
$sources = @()
$sources += Get-ChildItem -Recurse -Filter *.java (Join-Path $here "src") | ForEach-Object { $_.FullName }
$sources += Get-ChildItem -Recurse -Filter *.java (Join-Path $build "gen") | ForEach-Object { $_.FullName }
& javac -source 8 -target 8 -encoding UTF-8 -cp $androidJar -d $classes $sources
if ($LASTEXITCODE -ne 0) { throw "javac failed" }

Write-Host "Dexing..."
$d8 = Join-Path $buildTools "d8.bat"
$classFiles = Get-ChildItem -Recurse -Filter *.class $classes | ForEach-Object { $_.FullName }
& $d8 --lib $androidJar --min-api 23 --output $dex $classFiles
if ($LASTEXITCODE -ne 0) { throw "d8 failed" }

Write-Host "Packaging classes.dex..."
$pack = Join-Path $build "unsigned.apk"
Copy-Item (Join-Path $build "base.apk") $pack
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open($pack, "Update")
[System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
    $zip, (Join-Path $dex "classes.dex"), "classes.dex",
    [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
$zip.Dispose()

Write-Host "Signing..."
$keystore = Join-Path $build "wanderlog.jks"
& keytool -genkeypair -v -keystore $keystore -alias wanderlog -keyalg RSA -keysize 2048 `
    -validity 10000 -storepass wanderlog -keypass wanderlog `
    -dname "CN=Wanderlog, OU=COMP10013, O=UWS, L=Paisley, C=GB" | Out-Null

$aligned = Join-Path $build "aligned.apk"
& (Join-Path $buildTools "zipalign.exe") -p -f 4 $pack $aligned
if ($LASTEXITCODE -ne 0) { throw "zipalign failed" }

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$apk = Join-Path $OutDir "Wanderlog.apk"
& (Join-Path $buildTools "apksigner.bat") sign `
    --ks $keystore --ks-key-alias wanderlog `
    --ks-pass pass:wanderlog --key-pass pass:wanderlog `
    --out $apk $aligned
if ($LASTEXITCODE -ne 0) { throw "apksigner failed" }

& (Join-Path $buildTools "apksigner.bat") verify --verbose --print-certs $apk

Write-Host "APK ready: $apk"
Get-Item $apk | Select-Object FullName, Length
