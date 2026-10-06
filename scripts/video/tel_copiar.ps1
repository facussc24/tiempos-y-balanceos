# Copia videos del iPhone (MTP) a una carpeta de transito, de a uno y verificando que termino.
# Paso 3 de .claude/rules/video-maquina.md: antes va el indice (tel_indice.ps1) y el cruce
# (`node scripts/_videoBiblioteca.mjs --cruzar`). Este archivo va sin acentos (ANSI).
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/video/tel_copiar.ps1 `
#       -Mes 202610 -Archivos IMG_1066.MOV,IMG_1067.MOV -Destino C:\Dev\_telefono\<tarea>
#
# Explorer PREASIGNA el archivo entero: el peso no dice que termino. Termino cuando la COLA
# (los ultimos 256 KB, donde el .MOV guarda su indice) deja de ser ceros. Despues, ffprobe.
param(
    [Parameter(Mandatory = $true)][string]$Mes,
    [Parameter(Mandatory = $true)][string[]]$Archivos,
    [Parameter(Mandatory = $true)][string]$Destino,
    [int]$TopeSegundos = 1500
)
if ($Destino -match 'OneDrive|BARACK ARGENTINA SRL') { 'El transito va FUERA de la nube (C:\Dev\_telefono\...)'; exit 1 }
$Archivos = $Archivos | ForEach-Object { $_ -split ',' } | Where-Object { $_ }

$sh = New-Object -ComObject Shell.Application
$ip = $null
foreach ($i in $sh.NameSpace(17).Items()) { if ($i.Name -like '*iPhone*') { $ip = $i } }
if (-not $ip) { 'SIN IPHONE'; exit 1 }

$fuente = @{}
foreach ($st in $ip.GetFolder.Items()) {
    foreach ($m in $st.GetFolder.Items()) {
        if ($m.Name -notlike "$Mes*") { continue }
        foreach ($it in $m.GetFolder.Items()) {
            if (($Archivos -contains $it.Name) -and -not $fuente.ContainsKey($it.Name)) { $fuente[$it.Name] = $it }
        }
    }
}
New-Item -ItemType Directory -Force $Destino | Out-Null
$dest = $sh.NameSpace($Destino)
$fallas = 0
foreach ($nombre in $Archivos) {
    if (-not $fuente.ContainsKey($nombre)) { "NO ESTA EN EL TELEFONO: $nombre"; $fallas++; continue }
    $src = $fuente[$nombre]
    $esperado = [int64]$src.ExtendedProperty('System.Size')
    $a = Join-Path $Destino $nombre
    if ((Test-Path $a) -and ((Get-Item $a).Length -eq $esperado)) { "YA ESTABA: $nombre ($esperado bytes)"; continue }
    $dest.CopyHere($src, 16)
    $t0 = Get-Date
    $ok = $false
    while (((Get-Date) - $t0).TotalSeconds -lt $TopeSegundos) {
        Start-Sleep -Seconds 3
        if (-not (Test-Path $a)) { continue }
        $n = (Get-Item $a).Length
        if ($n -ne $esperado) { continue }
        try {
            $fs = [System.IO.File]::Open($a, 'Open', 'Read', 'ReadWrite')
            $k = [Math]::Min(262144, $n); $fs.Seek($n - $k, 'Begin') | Out-Null
            $buf = New-Object byte[] $k; $fs.Read($buf, 0, $k) | Out-Null; $fs.Close()
        } catch { continue }
        $nz = 0; foreach ($b in $buf) { if ($b -ne 0) { $nz++ } }
        if ($nz -gt 1000) { $ok = $true; break }
    }
    $seg = [int]((Get-Date) - $t0).TotalSeconds
    if ($ok) { "OK $nombre bytes=$esperado seg=$seg" } else { "TIMEOUT $nombre a los $seg s (esperado $esperado)"; $fallas++ }
}
if ($fallas) { exit 2 }
