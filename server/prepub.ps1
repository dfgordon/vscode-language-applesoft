# Run from project root, such as `.\server\prepub.ps1 darwin-arm64`
# This helps prepare for `vsce publish --target <platform>` by putting the appropriate
# server executable in `./server` and removing all others.
# It also makes some basic checks on the workspace.
param (
	[Parameter(Mandatory)]
	[ValidateSet("win32-x64","linux-x64","darwin-x64","darwin-arm64","universal")]
	[string]$platform
)

$changelog = Get-Content .\CHANGELOG.md
if ($changelog.ToLower() -match "unreleased") {
	Write-Error "unreleased appears in CHANGELOG"
	exit 1
}

$package1 = Get-Content .\package.json | ConvertFrom-Json
$package2 = Get-Content .\client\package.json | ConvertFrom-Json
if (! ($package1.version -match $package2.version)) {
	Write-Error "inner and outer package versions are different"
	exit 1
}
Write-Output ("package version is " + $package1.version)

$expected_re_patt = "## \[" + $package1.version + "\] - " + (Get-Date -Format yyyy-M-d)
if (! ($changelog -match $expected_re_patt)) {
	Write-Error ("expected pattern " + "not found in the CHANGELOG (" + $expected_re_patt + ")")
	exit 1
}

if ($platform -eq "universal") {
	Remove-Item server/server-*
	Get-ChildItem server
	return
}

if ($platform -eq "win32-x64") {
	$server = "x86_64-pc-windows-msvc"
} elseif ($platform -eq "linux-x64") {
	$server = "x86_64-unknown-linux-musl"
} elseif ($platform -eq "darwin-x64") {
	$server = "x86_64-apple-darwin"
} elseif ($platform -eq "darwin-arm64") {
	$server = "aarch64-apple-darwin"
}

$srcPath = $home + "/Downloads/result-" + $server + "/" + "server-applesoft-" + $server
if ($platform -eq "win32-x64") {
	$srcPath += ".exe"
}

Remove-Item server/server-*
Copy-Item -Path $srcPath -Destination server
Get-ChildItem server
