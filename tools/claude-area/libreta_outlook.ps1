# Lee la libreta de direcciones de la empresa que ya tiene Outlook clasico (solo lectura) y la deja en un JSON:
# nombre, mail, puesto, sector y si es una persona o una lista. No lee mails ni escribe nada en Outlook.
# Uso: powershell -File libreta_outlook.ps1 -Salida <archivo.json> [-Dominio barackmercosul.com]
# Solo ASCII en este archivo. El JSON sale en UTF-8.
param([Parameter(Mandatory = $true)][string]$Salida, [string]$Dominio = 'barackmercosul.com')
try { $ol = [Runtime.InteropServices.Marshal]::GetActiveObject('Outlook.Application') }
catch { Write-Output 'Outlook no esta abierto: no leo nada'; exit 3 }
$gal = $null
try { $gal = $ol.Session.GetGlobalAddressList() } catch { $gal = $null }
if ($null -eq $gal) { Write-Output 'Outlook no tiene a mano la libreta de la empresa'; exit 4 }
$filas = New-Object System.Collections.ArrayList
$n = $gal.AddressEntries.Count
for ($i = 1; $i -le $n; $i++) {
  $e = $gal.AddressEntries.Item($i)
  $tipo = [int]$e.AddressEntryUserType     # 0 = persona de la empresa, 1 = lista, 5 = contacto de afuera
  $mail = ''; $puesto = ''; $sector = ''
  if ($tipo -eq 0 -or $tipo -eq 5) {
    try { $u = $e.GetExchangeUser(); if ($null -ne $u) { $mail = [string]$u.PrimarySmtpAddress; $puesto = [string]$u.JobTitle; $sector = [string]$u.Department } } catch { }
  } elseif ($tipo -eq 1) {
    try { $g = $e.GetExchangeDistributionList(); if ($null -ne $g) { $mail = [string]$g.PrimarySmtpAddress } } catch { }
  }
  if (-not $mail) { continue }
  if ($Dominio -and -not $mail.ToLower().EndsWith('@' + $Dominio.ToLower())) { continue }
  [void]$filas.Add([ordered]@{ nombre = [string]$e.Name; mail = $mail.ToLower(); puesto = $puesto; sector = $sector; clase = $(if ($tipo -eq 1) { 'lista' } else { 'persona' }) })
}
$json = ConvertTo-Json -InputObject @($filas) -Depth 3
[System.IO.File]::WriteAllText($Salida, $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Output ("entradas de la libreta: " + $n + " | de la casa con mail: " + $filas.Count + " | escrito: " + $Salida)
