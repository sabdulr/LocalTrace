<#
.SYNOPSIS
Build the Windows installer, single-file portable executable and portable-folder ZIP.
.EXAMPLE
powershell -ExecutionPolicy Bypass -File scripts/build.ps1
.EXAMPLE
powershell -ExecutionPolicy Bypass -File scripts/build.ps1 -InstallDependencies -SkipTests
#>
[CmdletBinding()]
param([string]$OutputDirectory, [switch]$InstallDependencies, [switch]$SkipTests)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$savedEnvironment = @{}
foreach ($name in @('LOCALTRACE_DEV', 'LOCALTRACE_PACKAGED', 'ELECTRON_RUN_AS_NODE')) {
    $savedEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}
function Invoke-Node {
    param([string[]]$Arguments)
    & $script:nodePath @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Node command failed (exit $LASTEXITCODE): $($Arguments -join ' ')" }
}
function Invoke-Npm {
    param([string[]]$Arguments)
    if ($script:npmPath) {
        & $script:npmPath @Arguments
        if ($LASTEXITCODE -ne 0) { throw "npm command failed (exit $LASTEXITCODE): $($Arguments -join ' ')" }
    } else { Invoke-Node -Arguments (@($script:localNpm) + $Arguments) }
}
function Assert-Artifact {
    param([string]$Path)
    if (!(Test-Path -LiteralPath $Path -PathType Leaf) -or (Get-Item -LiteralPath $Path).Length -eq 0) {
        throw "Expected nonempty artifact: $Path"
    }
}

Push-Location -LiteralPath $projectRoot
try {
    if ($env:OS -ne 'Windows_NT') { throw 'Run this script on Windows x64.' }
    $script:nodePath = (Get-Command node -ErrorAction Stop).Source
    $nodeVersionText = & $script:nodePath --version
    if ($LASTEXITCODE -ne 0 -or [Version]($nodeVersionText.TrimStart('v')) -lt [Version]'22.12.0') { throw 'Node.js 22.12 or newer is required.' }
    $nodeArchitecture = & $script:nodePath -p 'process.arch'
    if ($LASTEXITCODE -ne 0 -or $nodeArchitecture -ne 'x64') { throw 'Use the Windows x64 Node.js runtime.' }
    $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if (!$npmCommand) { $npmCommand = Get-Command npm -ErrorAction SilentlyContinue }
    $script:npmPath = if ($npmCommand) { $npmCommand.Source } else { $null }
    $script:localNpm = Join-Path $projectRoot '.tools/package/bin/npm-cli.js'
    if (!$script:npmPath -and !(Test-Path -LiteralPath $script:localNpm)) { throw 'Install Node.js with npm, then reopen PowerShell.' }
    $package = Get-Content -LiteralPath 'package.json' -Raw | ConvertFrom-Json
    $version = [string]$package.version
    if ($version -notmatch '^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$') { throw 'Unsupported package version.' }
    Invoke-Node -Arguments @('-e', "const fs=require('fs'),p=JSON.parse(fs.readFileSync('package.json')),l=JSON.parse(fs.readFileSync('package-lock.json'));if(l.version!==p.version||l.packages[''].version!==p.version){console.error('Synchronize package.json and package-lock.json versions first.');process.exit(1)}")
    $startedUtc = [DateTime]::UtcNow.ToString('o')
    if (!$OutputDirectory) {
        $buildName = 'LocalTrace-{0}-{1}-{2}' -f $version, (Get-Date -Format 'yyyyMMdd-HHmmss'), ([Guid]::NewGuid().ToString('N').Substring(0, 6))
        $OutputDirectory = Join-Path 'release-builds' $buildName
    }
    if (![IO.Path]::IsPathRooted($OutputDirectory)) { $OutputDirectory = Join-Path $projectRoot $OutputDirectory }
    $outputPath = [IO.Path]::GetFullPath($OutputDirectory).TrimEnd('\', '/')
    $rootPrefix = $projectRoot.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
    if (!$outputPath.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'OutputDirectory must be a new directory inside the project.' }
    if (Test-Path -LiteralPath $outputPath) { throw "Output already exists; choose a new directory: $outputPath" }
    $ancestor = Split-Path -Parent $outputPath
    while ($ancestor -and $ancestor.Length -ge $projectRoot.Length) {
        if (Test-Path -LiteralPath $ancestor) {
            if ((Get-Item -LiteralPath $ancestor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Output cannot pass through a junction or symbolic link.' }
        }
        $ancestor = Split-Path -Parent $ancestor
    }
    $relativeOutput = $outputPath.Substring($rootPrefix.Length)
    if ($relativeOutput -match '^(?:node_modules|src|core|electron|scripts|tests|e2e|dist|vendor-licenses|\.git|\.tools)(?:[\\/]|$)') { throw 'Choose an output directory outside source/dependency/tool folders.' }
    foreach ($name in $savedEnvironment.Keys) { [Environment]::SetEnvironmentVariable($name, $null, 'Process') }
    Write-Host "Building LocalTrace $version using $nodeVersionText"
    Write-Host "Output: $outputPath"
    if ($InstallDependencies -or !(Test-Path -LiteralPath 'node_modules/electron-builder/cli.js')) { Invoke-Npm -Arguments @('ci') }
    if (!(Test-Path -LiteralPath 'node_modules/electron/dist/electron.exe')) { Invoke-Node -Arguments @('node_modules/electron/install.js') }
    if (!$SkipTests) { Invoke-Npm -Arguments @('test') }
    Invoke-Npm -Arguments @('run', 'build')
    Invoke-Node -Arguments @('scripts/notices.cjs')
    if (!$SkipTests) { Invoke-Npm -Arguments @('run', 'test:e2e') }
    Invoke-Node -Arguments @(
        'node_modules/electron-builder/cli.js', '--win', 'nsis', 'portable', '--x64', '--publish', 'never',
        "--config.directories.output=$outputPath",
        "--config.nsis.artifactName=LocalTrace-Setup-$version-x64.exe",
        "--config.portable.artifactName=LocalTrace-Portable-$version-x64.exe"
    )
    $installer = Join-Path $outputPath "LocalTrace-Setup-$version-x64.exe"
    $portable = Join-Path $outputPath "LocalTrace-Portable-$version-x64.exe"
    $unpacked = Join-Path $outputPath 'win-unpacked'
    $executable = Join-Path $unpacked 'LocalTrace.exe'
    foreach ($file in @($installer, $portable, $executable, (Join-Path $unpacked 'resources/app.asar'))) { Assert-Artifact -Path $file }
    if (!(Test-Path -LiteralPath (Join-Path $unpacked 'resources/app.asar.unpacked/node_modules/@img'))) { throw 'Packaged native image dependencies are missing.' }
    if (!$SkipTests) {
        $env:LOCALTRACE_PACKAGED = $executable
        Invoke-Npm -Arguments @('run', 'test:e2e')
        Remove-Item Env:LOCALTRACE_PACKAGED -ErrorAction SilentlyContinue
    }
    $documentation = Join-Path $outputPath 'documentation'
    New-Item -ItemType Directory -Path $documentation | Out-Null
    foreach ($file in @('README.md', 'Build_Instructions.md', 'support.md', 'prompt.md', 'ARCHITECTURE.md', 'Support_Report_Template.md', 'Release_Checklist.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md')) {
        Copy-Item -LiteralPath (Join-Path $projectRoot $file) -Destination $documentation
    }
    $zipPath = Join-Path $outputPath "LocalTrace-PortableFolder-$version-x64.zip"
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    # Explicit forward-slash entry names keep ZIPs portable under Windows PowerShell 5.1 too.
    $archive = [IO.Compression.ZipFile]::Open($zipPath, [IO.Compression.ZipArchiveMode]::Create)
    try {
        $archiveRoot = [IO.Path]::GetFullPath($unpacked).TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
        foreach ($sourceFile in Get-ChildItem -LiteralPath $unpacked -File -Recurse -Force) {
            $entryName = $sourceFile.FullName.Substring($archiveRoot.Length).Replace('\', '/')
            [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $sourceFile.FullName, $entryName, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
        }
    } finally { $archive.Dispose() }
    Assert-Artifact -Path $zipPath
    $artifactInfo = foreach ($file in @($installer, $portable, $zipPath)) {
        [ordered]@{ file = [IO.Path]::GetFileName($file); bytes = (Get-Item -LiteralPath $file).Length; sha256 = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash }
    }
    $manifest = [ordered]@{
        application = 'LocalTrace'; version = $version; architecture = 'x64'; node = $nodeVersionText
        startedUtc = $startedUtc; completedUtc = [DateTime]::UtcNow.ToString('o')
        automatedTests = $(if ($SkipTests) { 'Skipped by request' } else { 'Unit/integration, source desktop, and unpacked desktop passed' })
        singleFilePortable = 'Built; self-extraction launch requires separate manual verification'
        signing = 'See builder output; signing depends on the build environment. No certificate is configured in this repository.'
        artifacts = @($artifactInfo)
    }
    $manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $outputPath 'build-manifest.json') -Encoding UTF8
    $artifactInfo | ForEach-Object { '{0}  {1}' -f $_.sha256, $_.file } | Set-Content -LiteralPath (Join-Path $outputPath 'SHA256SUMS.txt') -Encoding ASCII
    Write-Host 'Build completed successfully.' -ForegroundColor Green
    foreach ($file in @($installer, $portable, $zipPath)) { Write-Host $file }
    Write-Host "Unpacked app: $executable"
    Write-Host 'Keep the complete unpacked folder together. Manually verify the self-extracting launcher before distribution.'
} catch {
    Write-Error -Message $_.Exception.Message -ErrorAction Continue
    exit 1
} finally {
    foreach ($name in $savedEnvironment.Keys) { [Environment]::SetEnvironmentVariable($name, $savedEnvironment[$name], 'Process') }
    Pop-Location
}
