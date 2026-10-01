# Abre en Outlook un mail de DEMOSTRACION (nunca se envia), le saca la captura a esa ventana sola y lo cierra
# SIN guardar. No toca ningun otro mail abierto. Solo ASCII en este archivo; el texto del mail sale de mail_demo.txt.
# El destinatario es un nombre de demostracion sin direccion: este mail no puede salir.
# Uso: powershell -File mail_demo.ps1 -Salida <archivo.png>
param([Parameter(Mandatory = $true)][string]$Salida)
$aqui = $PSScriptRoot
$cuerpo = Get-Content -LiteralPath (Join-Path $aqui 'mail_demo.txt') -Encoding UTF8 -Raw
try { $ol = [Runtime.InteropServices.Marshal]::GetActiveObject('Outlook.Application') }
catch { Write-Output 'Outlook no esta abierto: no hago nada'; exit 1 }
$m = $ol.CreateItem(0)
$r = $m.Recipients.Add('Recursos Humanos')
$r.Type = 1
$m.Subject = 'Pedido de capacitacion: uso de calibre (2 operarios de costura)'
$m.BodyFormat = 1
$m.Body = $cuerpo
$m.Display()
Start-Sleep -Seconds 3
$ins = $m.GetInspector
$ins.WindowState = 2      # normal (ni maximizada ni minimizada)
$ins.Left = 120; $ins.Top = 60; $ins.Width = 1100; $ins.Height = 640
$ins.Activate()
Start-Sleep -Seconds 2
$titulo = 'Pedido de capacitacion: uso de calibre'
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $aqui 'capturar.ps1') -Salida $Salida -Titulo $titulo -DeLaVentana
Start-Sleep -Milliseconds 500
$m.Close(1)               # 1 = cerrar SIN guardar (solo este mail de demostracion)
Write-Output 'mail de demostracion cerrado sin guardar'
