# nubeMedir.ps1 - mide carpetas de la biblioteca de Ingenieria SOLO por atributos: no abre ningun archivo.
# (Este archivo va sin tildes ni enies a proposito: powershell.exe lee un .ps1 como ANSI.)
#
# Lo usan scripts/_nubeSimular.mjs y scripts/_nubeMapa.mjs (tanda 7 del plan del sistema, 17/10/2026). Va en
# PowerShell porque Node no ve los atributos de Windows (lo mismo que _nubeSubio.ps1).
#
# Que se mira de cada archivo (metadatos del directorio; listar no baja nada, abrir si: memorias
# feedback_no_scan_onedrive y reference_onedrive_files_on_demand_liberar_espacio):
#   - Length y LastWriteTime: el peso es el de la nube, aunque el archivo no ocupe nada en esta PC.
#   - RECALL_ON_DATA_ACCESS (0x400000): el archivo vive solo en la nube. Es el UNICO marcador que vale para
#     "en disco o no": Offline (0x1000) confunde (04/09/2026: 4.926 "hidratados" que eran 35).
#   - ReparsePoint (0x400) en un archivo: ya subio. Sin el, quedo pendiente de subir (como _nubeSubio.ps1).
#
# Entrada: un JSON en UTF-8 (-Entrada) con { raiz, carpetas: [nombre de primer nivel...], tope_seg, dias_recientes }.
# La raiz viaja en el JSON, nunca como literal de este archivo.
# Salida: un JSON en UTF-8 (-Salida) con el espacio libre de C: antes y despues y, por carpeta de primer nivel, sus
# numeros y los de cada subcarpeta de segundo nivel. Corre en prioridad baja (Idle) para no robarle la PC a Fak.
# Una carpeta que pasa su tope de segundos queda con terminado = false: el que lee no escribe ese numero como total.
param([Parameter(Mandatory = $true)][string]$Entrada, [Parameter(Mandatory = $true)][string]$Salida)

try { (Get-Process -Id $PID).PriorityClass = 'Idle' } catch { }
$cfg = Get-Content -LiteralPath $Entrada -Raw -Encoding UTF8 | ConvertFrom-Json
$raiz = [string]$cfg.raiz
$tope = [double]$cfg.tope_seg
$desde = (Get-Date).ToUniversalTime().AddDays(-[double]$cfg.dias_recientes)
$RECALL = 0x400000
$REPARSE = 0x400

function Nuevo { [ordered]@{ archivos = 0; bytes = [int64]0; archivos_disco = 0; bytes_disco = [int64]0; sin_subir = 0; recientes = 0; ultima = $null; ultimo_nombre = $null; ultimo_carpeta = $null } }
function Ignorado([string]$n) { $n -eq 'Thumbs.db' -or $n -eq 'desktop.ini' -or $n.StartsWith('~$') -or $n.StartsWith('.849C9593') }
function Sumar($b, [System.IO.FileInfo]$f) {
    $a = [int64]$f.Attributes
    $b.archivos++; $b.bytes += $f.Length
    if (-not ($a -band $RECALL)) { $b.archivos_disco++; $b.bytes_disco += $f.Length }
    if (-not ($a -band $REPARSE)) { $b.sin_subir++ }
    $t = $f.LastWriteTimeUtc
    if ($t -ge $desde) { $b.recientes++ }
    if ($null -eq $b.ultima -or $t -gt $b.ultima) { $b.ultima = $t; $b.ultimo_nombre = $f.Name; $b.ultimo_carpeta = $f.DirectoryName }
}

$libreAntes = ([System.IO.DriveInfo]::new('C')).AvailableFreeSpace
$res = @()
foreach ($nombre in $cfg.carpetas) {
    $p = Join-Path $raiz ([string]$nombre)
    $item = [ordered]@{ nombre = [string]$nombre; existe = (Test-Path -LiteralPath $p -PathType Container); terminado = $true; segundos = 0; total = (Nuevo); sueltos = (Nuevo); sub = [ordered]@{} }
    if (-not $item.existe) { $res += $item; continue }
    $reloj = [System.Diagnostics.Stopwatch]::StartNew()
    # Primer nivel: los archivos sueltos y una cuenta por subcarpeta (el segundo nivel del mapa).
    $pila = New-Object System.Collections.Stack
    try {
        foreach ($e in ([System.IO.DirectoryInfo]::new($p)).EnumerateFileSystemInfos()) {
            if ($e -is [System.IO.DirectoryInfo]) { $item.sub[$e.Name] = (Nuevo); $pila.Push(@($e, $e.Name)) }
            elseif (-not (Ignorado $e.Name)) { Sumar $item.total $e; Sumar $item.sueltos $e }
        }
    } catch { $item.terminado = $false }
    while ($pila.Count -gt 0) {
        if ($reloj.Elapsed.TotalSeconds -gt $tope) { $item.terminado = $false; break }
        $par = $pila.Pop(); $d = $par[0]; $clave = $par[1]
        try {
            foreach ($e in $d.EnumerateFileSystemInfos()) {
                if ($e -is [System.IO.DirectoryInfo]) { $pila.Push(@($e, $clave)) }
                elseif (-not (Ignorado $e.Name)) { Sumar $item.total $e; Sumar $item.sub[$clave] $e }
            }
        } catch { $item.terminado = $false }
    }
    $item.segundos = [math]::Round($reloj.Elapsed.TotalSeconds, 1)
    # La fecha sale como texto en hora local (ConvertTo-Json la escribiria como /Date(ms)/).
    # y la carpeta del archivo mas nuevo, relativa a la de primer nivel (de ahi se infiere quien escribe)
    foreach ($b in @($item.total, $item.sueltos) + @($item.sub.Values)) {
        if ($null -ne $b.ultima) { $b.ultima = $b.ultima.ToLocalTime().ToString('yyyy-MM-dd HH:mm') }
        if ($b.ultimo_carpeta) { $b.ultimo_carpeta = $b.ultimo_carpeta.Substring([math]::Min($p.Length, $b.ultimo_carpeta.Length)).TrimStart('\') }
    }
    $res += $item
}
# Opcional (cfg.leibles): los programas que viven EN la nube y corren copiados en otras PC. Se listan con su
# marcador: el que lee (Node) abre solo los que estan en esta PC (local = true); uno solo-nube no se abre.
$leibles = @()
if ($cfg.leibles) {
    $exts = @($cfg.leibles.extensiones)
    foreach ($nombre in $cfg.leibles.carpetas) {
        $p = Join-Path $raiz ([string]$nombre)
        if (-not (Test-Path -LiteralPath $p -PathType Container)) { continue }
        $pila = New-Object System.Collections.Stack
        $pila.Push([System.IO.DirectoryInfo]::new($p))
        while ($pila.Count -gt 0) {
            $d = $pila.Pop()
            try {
                foreach ($e in $d.EnumerateFileSystemInfos()) {
                    if ($e -is [System.IO.DirectoryInfo]) { $pila.Push($e); continue }
                    if ($exts -notcontains $e.Extension.ToLower()) { continue }
                    $leibles += [ordered]@{ ruta = $e.FullName.Substring($raiz.Length).TrimStart('\'); local = (-not ([int64]$e.Attributes -band $RECALL)); bytes = $e.Length }
                }
            } catch { }
        }
    }
}
$libreDespues = ([System.IO.DriveInfo]::new('C')).AvailableFreeSpace

$out = [ordered]@{ medido = (Get-Date).ToString('yyyy-MM-dd HH:mm'); libre_antes = $libreAntes; libre_despues = $libreDespues; carpetas = $res; leibles = $leibles }
$json = $out | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText($Salida, $json, (New-Object System.Text.UTF8Encoding($false)))
