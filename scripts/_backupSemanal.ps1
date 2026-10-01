# Backup semanal de Supabase. Lo corre el Programador de tareas de Windows los lunes.
# A mano:  powershell -ExecutionPolicy Bypass -File scripts\_backupSemanal.ps1
#
# Por que existe: el 21/09/2026 el proyecto de Supabase aparecio PAUSADO. El plan free
# pausa el proyecto a los 7 dias sin actividad y le saca el registro DNS, asi que el host
# deja de existir y la app no conecta. El ultimo toque habia sido el backup del 11/09.
# Esta tarea mata dos pajaros: deja el snapshot semanal Y mantiene despierto el proyecto,
# porque las consultas del backup cuentan como actividad.
#
# No borra nada: si la carpeta de backups crece, lo avisa en el log y lo decide Fak.

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$log  = Join-Path $raiz 'backups\backup-semanal.log'

function Escribir($txt) {
  $linea = '{0}  {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm'), $txt
  Write-Host $linea
  $dir = Split-Path -Parent $log
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  Add-Content -Path $log -Value $linea -Encoding UTF8
}

Push-Location $raiz
try {
  $salida = & node 'scripts\_backup.mjs' 2>&1
  $code   = $LASTEXITCODE
} finally {
  Pop-Location
}
foreach ($l in $salida) { Escribir ('  | {0}' -f $l) }

if ($code -ne 0) {
  Escribir ('RESULTADO: ERROR (codigo {0}) — si dice ENOTFOUND, el proyecto esta pausado: se despausa desde el panel de Supabase.' -f $code)
} else {
  Escribir 'RESULTADO: OK'
}

# Aviso de espacio: cada backup pesa ~19 MB. No se borra solo.
$dirBk = Join-Path $raiz 'backups'
if (Test-Path $dirBk) {
  $mb = [math]::Round((Get-ChildItem $dirBk -Recurse -File | Measure-Object Length -Sum).Sum / 1MB)
  Escribir ('backups/ ocupa {0} MB' -f $mb)
  if ($mb -gt 1024) { Escribir 'AVISO: backups/ paso 1 GB. Conviene archivar los viejos en un zip.' }
}

exit $code
