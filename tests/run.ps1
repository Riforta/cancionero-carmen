# Corre una prueba del cancionero en Chrome headless (ver tests/README.md).
# Uso:  powershell -File tests/run.ps1 [prueba.mjs] [argumentos extra]
#   tests/run.ps1                        -> todo.mjs (regresión completa)
#   tests/run.ps1 capturas.mjs --referencia
# Levanta el servidor y un Chrome con perfil nuevo, corre la prueba y limpia.
param(
  [string]$Script = 'todo.mjs',
  [Parameter(ValueFromRemainingArguments = $true)][string[]]$Extra
)
$tests = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = Split-Path -Parent $tests
$salida = Join-Path $tests 'salida'
New-Item -ItemType Directory -Force $salida | Out-Null

# Node 22+ (trae fetch y WebSocket); el node por defecto de la máquina puede ser viejo
$node = Join-Path $env:LOCALAPPDATA 'nvm\v22.14.0\node.exe'
if (-not (Test-Path $node)) { $node = 'node' }
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'

$tag = "cancionero-tests-$(Get-Random)"
$perfil = Join-Path $env:TEMP $tag
$server = Start-Process python -ArgumentList '-m', 'http.server', '8642' -WorkingDirectory $repo -WindowStyle Hidden -PassThru
Start-Process $chrome -ArgumentList '--headless=new', '--remote-debugging-port=9223', '--remote-allow-origins=*', "--user-data-dir=$perfil", '--no-first-run', 'about:blank'
Start-Sleep 3
try {
  & $node (Join-Path $tests $Script) $salida @Extra
} finally {
  Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like "*$tag*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
  Get-CimInstance Win32_Process -Filter "Name='python.exe'" | Where-Object { $_.CommandLine -like '*http.server*8642*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}
