# Indice del iPhone conectado por USB (no copia nada): carpeta, archivo, creado, bytes.
# Es el paso 1 de .claude/rules/video-maquina.md; lo lee `node scripts/_videoBiblioteca.mjs --cruzar`.
# Este archivo va sin acentos: powershell.exe lo lee como ANSI.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/video/tel_indice.ps1              (videos del mes en curso)
#   ... -Mes 202609            (otro mes; "2026" trae todos los meses de 2026)
#   ... -ConFotos              (tambien HEIC/JPG/PNG)
#
# El iPhone no muestra DCIM: muestra una carpeta por mes (202610_a, 202610_b...). La _b repite
# archivos de la _a (mismo nombre y mismos bytes): se descartan.
param(
    [string]$Mes = (Get-Date -Format 'yyyyMM'),
    [string]$Salida = '',
    [switch]$ConFotos
)
if (-not $Salida) { $Salida = "C:\Dev\_telefono\INDICE_TELEFONO_$Mes.tsv" }
$ext = if ($ConFotos) { '\.(MOV|MP4|M4V|HEIC|JPG|JPEG|PNG)$' } else { '\.(MOV|MP4|M4V)$' }

$sh = New-Object -ComObject Shell.Application
$ip = $null
foreach ($i in $sh.NameSpace(17).Items()) { if ($i.Name -like '*iPhone*') { $ip = $i } }
if (-not $ip) { 'SIN IPHONE: no aparece en Este equipo (cable, o falta tocar "Confiar" en el telefono)'; exit 1 }

$meses = @()
$vistos = @{}
$out = @()
foreach ($st in $ip.GetFolder.Items()) {
    foreach ($m in $st.GetFolder.Items()) {
        $meses += $m.Name
        if ($m.Name -notlike "$Mes*") { continue }
        $f = $m.GetFolder
        foreach ($it in $f.Items()) {
            if ($it.Name -notmatch $ext) { continue }
            $bytes = $it.ExtendedProperty('System.Size')
            $clave = "$($it.Name)|$bytes"
            if ($vistos.ContainsKey($clave)) { continue }
            $vistos[$clave] = 1
            $out += "{0}`t{1}`t{2}`t{3}" -f $m.Name, $it.Name, $f.GetDetailsOf($it, 4), $bytes
        }
    }
}
if ($meses.Count -eq 0) { 'IPHONE BLOQUEADO: aparece pero no muestra carpetas (desbloquearlo y tocar "Permitir")'; exit 2 }

New-Item -ItemType Directory -Force (Split-Path $Salida) | Out-Null
$enc = New-Object System.Text.UTF8Encoding($true)
$lineas = @("carpeta`tarchivo`tcreado`tbytes") + ($out | Sort-Object)
[System.IO.File]::WriteAllLines($Salida, $lineas, $enc)
"carpetas del telefono: " + (($meses | Sort-Object | Select-Object -Last 6) -join ' ')
"indice: $Salida  (n=$($out.Count))"
$out | Sort-Object
