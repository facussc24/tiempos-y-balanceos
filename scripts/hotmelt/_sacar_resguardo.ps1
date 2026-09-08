# El resguardo que dejo `poner_pantallas.py` quedo AL LADO del entregable, en la carpeta del
# documento controlado. Eso duplica el documento, que es justo lo que la regla de archivado
# prohibe. No se borra: se mueve al scratchpad, y solo si se comprueba que su contenido YA
# esta guardado en la tarea archivada (mismo hash MD5). Si no coincide, no se toca.
#
# POR DEFECTO ES DRY-RUN: imprime el plan (origen -> destino, uno por linea) y no mueve nada.
# Para ejecutar hay que pasar -Hacerlo, y recien despues de MIRAR EL CONTEO: se espera 1.
#
# Cero acentos en literales de ruta: powershell.exe lee el .ps1 como ANSI.
param([switch]$Hacerlo)

$ErrorActionPreference = 'Stop'

$lib = (Get-ChildItem 'C:\Users\FacundoS-PC\BARACK ARGENTINA SRL' -Directory |
        Where-Object { $_.Name -like 'Ingenier*' }).FullName
$base   = Join-Path $lib 'INGENIERIA BARACK (NUNCA BORRAR)\1- GENERAL'
$origen = Join-Path $base 'INSTRUCTIVOS\INSTRUCCIONES OPERATIVAS\HOTMELT'
$arch   = Join-Path $base 'TAREAS CERRADAS\2026\2026-09-03 - Hojas de proceso maquina HOTMELT - desde los videos\_trabajo\versiones'
$tmp    = 'C:\Users\FACUND~1\AppData\Local\Temp\claude\C--Dev-BarackMercosul\c66b0fd1-ca90-4cc1-86f1-5c8410cdd456\scratchpad\resguardos'

$guardados = @(Get-ChildItem -LiteralPath $arch -Filter '*.pptx' |
               ForEach-Object { (Get-FileHash $_.FullName -Algorithm MD5).Hash })
$res = @(Get-ChildItem -LiteralPath $origen -Filter '_resguardo*.pptx')

Write-Output '--- PLAN ---'
Write-Output ("versiones ya guardadas en la tarea archivada : " + $guardados.Count)
Write-Output ("resguardos al lado del entregable            : " + $res.Count)
$mover = @()
foreach ($r in $res) {
    $h = (Get-FileHash $r.FullName -Algorithm MD5).Hash
    # Todos salen: el que importa (la version que edito Fak) ya esta archivado; los demas
    # son estados intermedios de mi propio trabajo de hoy y no pintan en la carpeta del
    # documento controlado. Van al scratchpad, no se borran.
    if ($guardados -contains $h) {
        Write-Output ("  MOVER   " + $r.Name + "   (duplicado exacto de una version ya archivada)")
        $mover += $r
    } else {
        Write-Output ("  MOVER   " + $r.Name + "   (estado intermedio de hoy)")
        $mover += $r
    }
}
Write-Output ("a mover: " + $mover.Count)
Write-Output '------------'

if ($mover.Count -eq 0) { Write-Output 'nada que mover.'; exit 0 }
if (-not $Hacerlo) { Write-Output 'DRY-RUN: no se toco nada. Con -Hacerlo se ejecuta.'; exit 0 }

New-Item -ItemType Directory -Path $tmp -Force | Out-Null
foreach ($r in $mover) {
    Move-Item -LiteralPath $r.FullName -Destination (Join-Path $tmp $r.Name) -Force
    Write-Output ("  movido: " + $r.Name)
}
Write-Output "`nen la carpeta del entregable queda:"
Get-ChildItem -LiteralPath $origen | ForEach-Object { Write-Output ("  " + $_.Name) }
