[CmdletBinding()]
param(
    [string]$ApiUrl,
    [string]$AndroidSdk,
    [string]$JavaHome,
    [string]$Architectures = 'arm64-v8a,x86_64',
    [switch]$SkipPrebuild
)

$ErrorActionPreference = 'Stop'
$mobileRoot = Split-Path -Parent $PSScriptRoot
$repositoryRoot = Split-Path -Parent $mobileRoot
$toolsRoot = Join-Path $repositoryRoot '.mobile-tools'
$artifactRoot = Join-Path $mobileRoot 'artifacts'

function Invoke-Checked {
    param([string]$Command, [string[]]$Arguments)
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Command exited with code $LASTEXITCODE."
    }
}

if (-not (Test-Path -LiteralPath (Join-Path $mobileRoot 'node_modules/expo/bin/cli'))) {
    throw 'Install mobile dependencies first: cd mobile; npm ci'
}

if (-not $AndroidSdk) {
    $localSdk = Join-Path $toolsRoot 'android-sdk'
    $AndroidSdk = if (Test-Path -LiteralPath $localSdk) { $localSdk }
        elseif ($env:ANDROID_HOME) { $env:ANDROID_HOME }
        elseif ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT }
        else { Join-Path $env:LOCALAPPDATA 'Android/Sdk' }
}
if (-not (Test-Path -LiteralPath $AndroidSdk)) {
    throw 'Android SDK not found. Set ANDROID_HOME or pass -AndroidSdk with its path.'
}
$AndroidSdk = (Resolve-Path -LiteralPath $AndroidSdk).Path

if (-not $JavaHome) { $JavaHome = $env:JAVA_HOME }
if (-not $JavaHome -or -not (Test-Path -LiteralPath (Join-Path $JavaHome 'bin/java.exe'))) {
    throw 'Set JAVA_HOME to JDK 17 or a version supported by this Expo Android toolchain.'
}

if ($Architectures -notmatch '^(arm64-v8a|armeabi-v7a|x86|x86_64)(,(arm64-v8a|armeabi-v7a|x86|x86_64))*$') {
    throw 'Architectures must be a comma-separated list of Android ABIs.'
}
if ($ApiUrl) {
    $parsedApi = $null
    if (-not [Uri]::TryCreate($ApiUrl, [UriKind]::Absolute, [ref]$parsedApi) -or
        $parsedApi.Scheme -notin @('http', 'https') -or $parsedApi.UserInfo) {
        throw 'ApiUrl must be an absolute HTTP(S) API URL without credentials.'
    }
    $env:EXPO_PUBLIC_API_URL = $ApiUrl.TrimEnd('/')
}

$env:JAVA_HOME = $JavaHome
$env:ANDROID_HOME = $AndroidSdk
$env:ANDROID_SDK_ROOT = $AndroidSdk
$env:GRADLE_USER_HOME = Join-Path $toolsRoot 'gradle-home'
$env:CI = '1'
$env:Path = (Join-Path $JavaHome 'bin') + ';' + (Join-Path $AndroidSdk 'platform-tools') + ';' + $env:Path
New-Item -ItemType Directory -Path $env:GRADLE_USER_HOME, $artifactRoot -Force | Out-Null

Push-Location $mobileRoot
try {
    if (-not $SkipPrebuild) {
        Invoke-Checked 'node' @('node_modules/expo/bin/cli', 'prebuild', '--platform', 'android', '--no-install')
    }
    $androidRoot = Join-Path $mobileRoot 'android'
    $appGradlePath = Join-Path $androidRoot 'app/build.gradle'
    if (-not (Test-Path -LiteralPath $appGradlePath)) {
        throw 'Android native project is missing. Run this script without -SkipPrebuild.'
    }

    # Expo's generated release variant uses the debug signing key. This build is
    # deliberately for sideloaded testing; production distribution needs its own key.
    $appGradle = Get-Content -LiteralPath $appGradlePath -Raw
    if ($appGradle -notmatch '(?s)release\s*\{\s*(?://[^\r\n]*[\r\n]\s*)*signingConfig\s+signingConfigs\.debug') {
        throw 'Expected Expo release variant signed with the test/debug key. Review signing configuration before building.'
    }
    $sdkProperty = 'sdk.dir=' + ($AndroidSdk -replace '\\', '/')
    [IO.File]::WriteAllText((Join-Path $androidRoot 'local.properties'), $sdkProperty + [Environment]::NewLine)

    Push-Location $androidRoot
    try {
        Invoke-Checked '.\gradlew.bat' @(
            ':app:assembleRelease',
            '--no-daemon',
            '--console=plain',
            '--max-workers=4',
            "-PreactNativeArchitectures=$Architectures",
            '-Dorg.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m'
        )
    }
    finally { Pop-Location }

    $builtApk = Join-Path $androidRoot 'app/build/outputs/apk/release/app-release.apk'
    if (-not (Test-Path -LiteralPath $builtApk)) { throw 'Gradle completed without producing the expected APK.' }
    $artifactPath = Join-Path $artifactRoot 'steam-achievements-test.apk'
    Copy-Item -LiteralPath $builtApk -Destination $artifactPath -Force

    $buildTools = Get-ChildItem -LiteralPath (Join-Path $AndroidSdk 'build-tools') -Directory |
        Where-Object { $_.Name -match '^\d+\.\d+\.\d+$' } |
        Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1
    if (-not $buildTools) { throw 'Android build-tools with apksigner are required to verify the APK.' }
    Invoke-Checked (Join-Path $buildTools.FullName 'apksigner.bat') @('verify', '--verbose', '--print-certs', $artifactPath)

    $checksum = (Get-FileHash -LiteralPath $artifactPath -Algorithm SHA256).Hash.ToLowerInvariant()
    [IO.File]::WriteAllText("$artifactPath.sha256", "$checksum  steam-achievements-test.apk" + [Environment]::NewLine)
    Write-Host "Test APK: $artifactPath"
    Write-Host "SHA256: $checksum"
    Write-Host 'The JavaScript bundle is included: Metro/Expo Go is not required.'
    Write-Host 'Signed with a test/debug key. Use a separate production signing key for store distribution.'
}
finally { Pop-Location }
