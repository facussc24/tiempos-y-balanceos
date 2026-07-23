# _extraerSgc.ps1 — extrae .doc/.docx de una carpeta del servidor a extractos .md
# del cache .sgc-cache/ (skill docs-empresa). Word COM (maneja .doc legacy y .docx).
#
# Uso:
#   powershell -File scripts/_extraerSgc.ps1 -Source "<carpeta origen>" -Dest "<subcarpeta .sgc-cache>"
#
# Reglas: ignora ~$ temporales y "- copia"; de cada documento multi-rev
# ("P-18 Formacion D.doc" / "E.doc" / "F.doc") extrae SOLO la rev de letra MAYOR
# (regla canonica: Rev = numero/letra MAYOR). No recursivo (correr por carpeta).
param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Dest
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path $Source)) { Write-Error "No existe la carpeta origen: $Source"; exit 1 }
New-Item -ItemType Directory -Force $Dest | Out-Null

$files = Get-ChildItem -Path $Source -File | Where-Object {
    $_.Extension -match '^\.(doc|docx)$' -and
    $_.Name -notlike '~$*' -and
    $_.Name -notmatch '- copia'
}
if (-not $files) { Write-Output "Sin .doc/.docx en $Source"; exit 0 }

# agrupar por nombre base sin la letra de revision final: "P-18 Formacion D" -> base "P-18 Formacion", rev "D"
$grupos = @{}
foreach ($f in $files) {
    $stem = [IO.Path]::GetFileNameWithoutExtension($f.Name)
    if ($stem -match '^(.*\S)\s+([A-Z])$') { $base = $Matches[1]; $rev = $Matches[2] }
    else { $base = $stem; $rev = '' }
    if (-not $grupos.ContainsKey($base)) { $grupos[$base] = @() }
    $grupos[$base] += , @($rev, $f)
}

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
$tmp = Join-Path $env:TEMP ("sgc_extract_" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force $tmp | Out-Null
$hoy = Get-Date -Format 'yyyy-MM-dd'
$n = 0

try {
    foreach ($base in ($grupos.Keys | Sort-Object)) {
        $mejor = $grupos[$base] | Sort-Object { $_[0] } | Select-Object -Last 1
        $rev = $mejor[0]; $f = $mejor[1]
        try {
            # copia local primero: abrir .doc directo de una ruta UNC cuelga Word (Vista Protegida)
            $local = Join-Path $tmp $f.Name
            Copy-Item $f.FullName $local -Force
            $doc = $word.Documents.Open($local, $false, $true)  # ConfirmConversions, ReadOnly
            # Content.Text directo del COM (SaveAs2 a txt sale con encoding roto)
            $texto = $doc.Content.Text -replace "`r", "`n"
            $doc.Close($false)
            Remove-Item $local -Force -Confirm:$false
            $safe = ($base -replace '[^\w\-. ]', '_').Trim()
            $out = Join-Path $Dest ($safe + '.md')
            $fm = @(
                '---',
                ('fuente: "' + $f.FullName.Replace('\', '/') + '"'),
                ('rev: "' + $rev + '"'),
                ('extraido: ' + $hoy),
                '---',
                '',
                ('# ' + $base + ($(if ($rev) { " (rev $rev)" } else { '' }))),
                ''
            ) -join "`n"
            ($fm + $texto) | Out-File -FilePath $out -Encoding utf8
            $kb = [math]::Round((Get-Item $out).Length / 1KB)
            Write-Output ("OK  " + $base + " (rev '" + $rev + "') -> " + $out + " [" + $kb + " KB]")
            $n++
        } catch {
            Write-Output ("FALLO " + $f.Name + ": " + $_.Exception.Message)
        }
    }
} finally {
    $word.Quit()
    [Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
    if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force -Confirm:$false }
}
Write-Output ("LISTO: " + $n + " extractos en " + $Dest)
