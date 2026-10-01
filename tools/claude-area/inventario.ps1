# inventario.ps1 - lista de programas instalados en esta PC (PowerShell 5.1, solo ASCII, sin administrador).
#
# QUE HACE: lee del registro de Windows el nombre, la version, el editor y la fecha de instalacion de
# los programas (las claves "Uninstall" de la maquina, de 32 bits y del usuario) y escribe UN archivo
# JSON en la ruta que se le pasa en -Salida (formato en CONTRATO.md, "inventario\<pc>.json").
#
# QUE NO HACE: no desinstala ni cambia nada, no escribe en el registro, no manda nada a ningun lado,
# no junta archivos, historial ni uso. Tampoco usa la clase de instaladores de WMI (la que dispara
# reconfiguraciones de los instaladores al consultarla): solo lee claves del registro.
#
# USO
#   inventario.ps1 -Salida C:\carpeta\inventario\PC-01.json    escribe el archivo
#   inventario.ps1 -Salida <carpeta>                           escribe <carpeta>\<nombre de la PC>.json
#   inventario.ps1 -Salida <ruta> -Mostrar                     escribe y ademas muestra en pantalla que se junto
#   inventario.ps1 -Mostrar                                    solo muestra en pantalla, no escribe nada
#   -Claves <claves del registro>                              SOLO PARA PRUEBAS: lee estas claves en vez de las tres de siempre
#
# Sale con 0 si todo salio bien, 1 si no pudo, 2 si faltan los parametros.

[CmdletBinding()]
param(
    [string]$Salida,
    [switch]$Mostrar,
    [string[]]$Claves
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

if (-not $Salida -and -not $Mostrar) {
    [Console]::Error.WriteLine('Falta -Salida (donde se escribe la lista) o -Mostrar (solo verla en pantalla).')
    exit 2
}

$reloj = [System.Diagnostics.Stopwatch]::StartNew()
$cultura = [System.Globalization.CultureInfo]::InvariantCulture

function Get-ValorTexto($clave, [string]$nombre) {
    $v = $clave.GetValue($nombre)
    if ($null -eq $v) { return '' }
    return ([string]$v).Trim()
}

# InstallDate viene como yyyymmdd; si no es una fecha entendible queda vacio (no se inventa).
function ConvertTo-FechaIso([string]$texto) {
    if ($texto -notmatch '^\d{8}$') { return '' }
    $f = [datetime]::MinValue
    $ok = [datetime]::TryParseExact($texto, 'yyyyMMdd', $cultura, [System.Globalization.DateTimeStyles]::None, [ref]$f)
    if (-not $ok) { return '' }
    if ($f.Year -lt 1995 -or $f -gt (Get-Date).AddDays(1)) { return '' }
    return $f.ToString('yyyy-MM-dd', $cultura)
}

try {
    $origenes = @(
        @{ Ruta = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall'; Alcance = 'maquina' },
        @{ Ruta = 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall'; Alcance = 'maquina' },
        @{ Ruta = 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall'; Alcance = 'usuario' }
    )
    if ($Claves) {
        # con -File PowerShell no separa "a,b" en dos valores: se separa aca
        $origenes = @($Claves | ForEach-Object { $_ -split ',' } | Where-Object { $_.Trim() -ne '' } | ForEach-Object { @{ Ruta = $_.Trim(); Alcance = $(if ($_ -like 'HKCU:*') { 'usuario' } else { 'maquina' }) } })
    }

    $vistos = @{}
    $programas = New-Object System.Collections.Generic.List[object]
    $omitidos = 0

    foreach ($origen in $origenes) {
        if (-not (Test-Path -LiteralPath $origen.Ruta)) { continue }
        foreach ($clave in (Get-ChildItem -LiteralPath $origen.Ruta)) {
            try {
                $nombre = Get-ValorTexto $clave 'DisplayName'
                if ($nombre -eq '') { continue }

                # Lo que Windows no muestra como programa: componentes del sistema, partes de otro
                # programa y actualizaciones. Se cuentan para decirlo, pero no entran a la lista.
                $sistema = $clave.GetValue('SystemComponent')
                $padre = Get-ValorTexto $clave 'ParentKeyName'
                $tipo = Get-ValorTexto $clave 'ReleaseType'
                $esActualizacion = ($tipo -match '^(Security Update|Update Rollup|Hotfix|Update)$') -or ($nombre -match '^(Security Update|Update|Hotfix) for .*KB\d+')
                if (($null -ne $sistema -and ([string]$sistema) -eq '1') -or $padre -ne '' -or $esActualizacion) {
                    $omitidos++
                    continue
                }

                $version = Get-ValorTexto $clave 'DisplayVersion'
                $dedup = $nombre.ToLowerInvariant() + '|' + $version.ToLowerInvariant()
                if ($vistos.ContainsKey($dedup)) { continue }
                $vistos[$dedup] = $true

                $programas.Add((New-Object psobject -Property ([ordered]@{
                    nombre   = $nombre
                    version  = $version
                    editor   = (Get-ValorTexto $clave 'Publisher')
                    instalado = (ConvertTo-FechaIso (Get-ValorTexto $clave 'InstallDate'))
                    alcance  = $origen.Alcance
                })))
            }
            catch {
                # una clave que no se puede leer no frena a las demas
                continue
            }
        }
    }

    # Orden por nombre (sin distinguir mayusculas, comparacion fija igual en todas las PC), despues version.
    $comparar = [System.Comparison[object]]{
        param($a, $b)
        $r = [string]::CompareOrdinal($a.nombre.ToLowerInvariant(), $b.nombre.ToLowerInvariant())
        if ($r -eq 0) { $r = [string]::CompareOrdinal($a.version.ToLowerInvariant(), $b.version.ToLowerInvariant()) }
        return $r
    }
    $programas.Sort($comparar)

    $documento = [ordered]@{
        pc              = $env:COMPUTERNAME
        usuario_windows = $env:USERNAME
        relevado        = (Get-Date).ToString('yyyy-MM-ddTHH:mm:ss', $cultura)
        programas       = @($programas.ToArray())
    }
    $json = ConvertTo-Json -InputObject $documento -Depth 5

    if ($Mostrar) {
        Write-Host ''
        Write-Host 'Esta es la lista de programas de esta PC. Es lo unico que se junta:'
        Write-Host 'nombre, version, editor, fecha de instalacion y si esta instalado para toda la PC o solo para tu usuario.'
        Write-Host 'No se junta nada de tus archivos, de tu historial ni de lo que usas.'
        Write-Host ''
        $tabla = ($programas.ToArray() | Format-Table -AutoSize -Property nombre, version, editor, instalado, alcance | Out-String -Width 250)
        Write-Host $tabla
        Write-Host ('Se dejaron afuera ' + $omitidos + ' componentes del sistema y actualizaciones de Windows, que no son programas.')
    }

    if ($Salida) {
        $ruta = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Salida)
        if (Test-Path -LiteralPath $ruta -PathType Container) {
            $archivo = ($env:COMPUTERNAME -replace '[\\/:*?"<>|]', '_') + '.json'
            $destino = Join-Path $ruta $archivo
        }
        else {
            $destino = $ruta
        }
        $carpeta = [System.IO.Path]::GetDirectoryName($destino)
        if (-not (Test-Path -LiteralPath $carpeta)) { [void](New-Item -ItemType Directory -Path $carpeta -Force) }

        # Escritura atomica: temporal en la misma carpeta y despues se reemplaza el archivo, para que
        # nadie (ni la nube) vea nunca una lista a medio escribir. UTF-8 sin BOM.
        $tmp = $destino + '.tmp-' + $PID
        try {
            [System.IO.File]::WriteAllText($tmp, $json, (New-Object System.Text.UTF8Encoding($false)))
            # (PowerShell convierte $null en "" al llamar a un metodo de .NET: sin copia de respaldo se pasa [NullString]::Value)
            if (Test-Path -LiteralPath $destino) { [System.IO.File]::Replace($tmp, $destino, [NullString]::Value) }
            else { [System.IO.File]::Move($tmp, $destino) }
        }
        catch {
            if (Test-Path -LiteralPath $tmp) { [System.IO.File]::Delete($tmp) }
            throw
        }
    }

    $reloj.Stop()
    $segundos = [math]::Round($reloj.Elapsed.TotalSeconds, 1).ToString($cultura)
    Write-Host ('Listo: ' + $programas.Count + ' programas anotados en ' + $segundos + ' segundos.')
    exit 0
}
catch {
    [Console]::Error.WriteLine('No se pudo armar la lista de programas: ' + $_.Exception.Message)
    exit 1
}
