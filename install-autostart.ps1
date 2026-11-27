# Adds (or with -Remove, removes) a shortcut in your Windows Startup folder
# so the deck analyzer server starts hidden every time you log in.
param([switch]$Remove)

$startup  = [Environment]::GetFolderPath('Startup')
$lnkPath  = Join-Path $startup 'Alysion Deck Analyzer.lnk'
$vbs      = Join-Path $PSScriptRoot 'start-hidden.vbs'

if ($Remove) {
  if (Test-Path $lnkPath) { Remove-Item $lnkPath; 'Autostart removed.' } else { 'Autostart was not installed.' }
  return
}

$sh  = New-Object -ComObject WScript.Shell
$lnk = $sh.CreateShortcut($lnkPath)
$lnk.TargetPath       = "$env:WINDIR\System32\wscript.exe"
$lnk.Arguments        = "`"$vbs`""
$lnk.WorkingDirectory = $PSScriptRoot
$lnk.Description      = 'Alysion Deck Analyzer (http://localhost:3000)'
$lnk.Save()
"Autostart installed: $lnkPath"
"Open http://localhost:3000 after login."
