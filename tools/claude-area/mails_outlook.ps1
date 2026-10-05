# mails_outlook.ps1 - LEE (solo lee) el buzon principal del Outlook clasico que la persona ya tiene abierto y escribe,
# por la salida estandar, un renglon JSON por cada mail recibido desde -Desde que no este en la lista de -Conocidos.
# Lo llama mails_area.mjs (paso "mails" de la tarea "Barack - Claude por area"). No decide que sube: eso lo hace
# mails_area.mjs con su filtro. Este programa no escribe en ningun lado, ni en Outlook ni en el disco.
#
# SOLO LECTURA: no manda, no guarda, no mueve, no borra, no marca como leido y no abre ventanas. Se engancha al Outlook
# que ya esta abierto y no lo cierra; si no esta abierto, no lo arranca. De los adjuntos solo toma el nombre.
#
# Uso (Windows PowerShell 5.1, sin dependencias):
#   powershell -NoProfile -ExecutionPolicy Bypass -File mails_outlook.ps1 -Desde 2026-07-01T00:00:00 [-Conocidos <archivo>]
#              [-MaxSegundos 780] [-MaxCuerpo 20000] [-PausaMs 20]
# Salida (UTF-8, un objeto JSON por renglon):
#   {"t":"buzon","casilla":".."}     la casilla del buzon que se esta leyendo ("" si no se pudo saber); va antes de los mails
#   {"t":"mail","id":..,"eid":..,"carpeta":..,"fecha":"AAAA-MM-DD HH:MM","de":..,"de_mail":..,"representa_mail":..,
#    "para":..,"para_mails":[..],"cc":..,"cc_mails":[..],"cco_mails":[..],"asunto":..,"adjuntos":[..],
#    "conversacion":..,"cuerpo":..,"reserva":0,"sin_resolver":0}     (reserva: 0 normal, 1 personal, 2 privado, 3 confidencial)
#   {"t":"latido","revisados":N}   cada 10 segundos mientras lee: si deja de llegar, Outlook no contesta (puede haber un cartel)
#   {"t":"estado","estado":"cerrado|nuevo|no_instalado|no_responde|error","detalle":".."}   (y no sigue)
#   {"t":"fin","completa":true|false,"revisados":N,"fallados":N}    (siempre el ultimo; fallados = mails que no se pudieron leer)
# Una casilla sale SOLO si tiene forma de casilla (algo@dominio.algo), recortada y en minusculas; lo que no (una direccion
# interna de Exchange, un nombre) sale vacio y suma a "sin_resolver": el filtro no deja subir ese mail. Un destinatario
# que es un GRUPO de correo tambien suma a "sin_resolver": desde aca no se ve quien lo integra. Lo mismo si no se pueden
# leer los adjuntos. Un destinatario al que no se le puede leer el tipo va con la copia oculta (no se publica).
# Un borrador guardado fuera de Borradores (todavia sin enviar) no se lee.
# Codigo de salida: 0 termino (completa o cortada por tiempo) | 4 no hay Outlook clasico abierto o no responde | 1 otra falla.
# Variable de prueba CLAUDE_AREA_SIN_OUTLOOK=1: hace de cuenta que Outlook no esta abierto.
# Solo ASCII en este archivo.
param(
  [string]$Desde = '',
  [string]$Conocidos = '',
  [int]$MaxSegundos = 780,
  [int]$MaxCuerpo = 20000,
  [int]$PausaMs = 20
)
$ErrorActionPreference = 'Stop'
$script:Utf8 = New-Object System.Text.UTF8Encoding($false)
$script:Flujo = [System.Console]::OpenStandardOutput()
$script:Reloj = [System.Diagnostics.Stopwatch]::StartNew()
$PROP_ID_INTERNET = 'http://schemas.microsoft.com/mapi/proptag/0x1035001F'
$PROP_SMTP_REMITENTE = 'http://schemas.microsoft.com/mapi/proptag/0x5D01001F'
$PROP_SMTP_REPRESENTA = 'http://schemas.microsoft.com/mapi/proptag/0x5D02001F'
$PROP_SMTP_DESTINATARIO = 'http://schemas.microsoft.com/mapi/proptag/0x39FE001F'
$RE_CASILLA = '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(\.[A-Za-z0-9\-]+)+$'
# Carpetas que no se leen NUNCA. Si Outlook no puede decir cuales son, no se lee nada:
#   Eliminados (3), Bandeja de salida (4), Borradores (16), Correo no deseado (23)
$CARPETAS_FUERA = @(3, 4, 16, 23)
# Tampoco estas (no son mails); si Outlook no las tiene, se sigue: problemas de sincronizacion (19 a 22) y fuentes RSS (25)
$CARPETAS_FUERA_SI_ESTAN = @(19, 20, 21, 22, 25)
# Y por nombre (sin tildes ni mayusculas): los chats guardados y las suscripciones
$NOMBRES_FUERA = @('historial de conversaciones', 'conversation history', 'fuentes rss', 'rss feeds', 'suscripciones rss', 'rss subscriptions')

function Renglon($objeto) {
  $texto = ($objeto | ConvertTo-Json -Compress -Depth 4)
  $bytes = $script:Utf8.GetBytes($texto + "`n")
  $script:Flujo.Write($bytes, 0, $bytes.Length)
  $script:Flujo.Flush()
}

function Terminar([string]$estado, [string]$detalle, [int]$codigo) {
  Renglon ([ordered]@{ t = 'estado'; estado = $estado; detalle = $detalle })
  Renglon ([ordered]@{ t = 'fin'; completa = $false; revisados = 0 })
  exit $codigo
}

function Limpiar([string]$texto, [int]$maximo) {
  if (-not $texto) { return '' }
  $t = $texto.Replace("`r`n", "`n").Replace("`r", "`n")
  $salida = New-Object System.Text.StringBuilder
  $vacias = 0
  foreach ($ln in $t.Split("`n")) {
    $l = $ln.TrimEnd()
    if ($l.Length -eq 0) { $vacias++ } else { $vacias = 0 }
    if ($vacias -le 1) { [void]$salida.Append($l).Append("`n") }
    if ($salida.Length -gt ($maximo + 200)) { break }
  }
  $r = $salida.ToString().Trim()
  if ($r.Length -gt $maximo) { $r = $r.Substring(0, $maximo) }
  return $r
}

function Texto($valor) { if ($null -eq $valor) { return '' } return [string]$valor }

function SinTildes([string]$t) {
  if (-not $t) { return '' }
  $d = $t.Normalize([System.Text.NormalizationForm]::FormD)
  $sb = New-Object System.Text.StringBuilder
  foreach ($c in $d.ToCharArray()) {
    if ([System.Globalization.CharUnicodeInfo]::GetUnicodeCategory($c) -ne [System.Globalization.UnicodeCategory]::NonSpacingMark) { [void]$sb.Append($c) }
  }
  return $sb.ToString().ToLowerInvariant().Trim()
}

# La casilla limpia, o '' si lo que llego no tiene forma de casilla (una direccion interna de Exchange, un nombre, basura).
function Casilla([string]$a) {
  if (-not $a) { return '' }
  $c = $a.Trim().Trim("'", '"', '<', '>', ' ')
  if ($c.Length -gt 5 -and $c.Substring(0, 5).ToLowerInvariant() -eq 'smtp:') { $c = $c.Substring(5).Trim() }
  $c = $c.TrimEnd('.', ',', ';')
  if ($c -match $RE_CASILLA) { return $c.ToLowerInvariant() }
  return ''
}

function DireccionDelRemitente($m) {
  try { $c = Casilla (Texto $m.PropertyAccessor.GetProperty($PROP_SMTP_REMITENTE)); if ($c) { return $c } } catch { }
  try {
    $eu = $m.Sender.GetExchangeUser()
    if ($null -ne $eu) { $c = Casilla (Texto $eu.PrimarySmtpAddress); if ($c) { return $c } }
  } catch { }
  try { $c = Casilla (Texto $m.SenderEmailAddress); if ($c) { return $c } } catch { }
  return ''
}

# A nombre de quien se mando ("enviado en nombre de"). '' si es el mismo remitente o no hay otro.
function DireccionDeQuienRepresenta($m) {
  try { $c = Casilla (Texto $m.PropertyAccessor.GetProperty($PROP_SMTP_REPRESENTA)); if ($c) { return $c } } catch { }
  return ''
}

function DireccionDelDestinatario($r) {
  try { $c = Casilla (Texto $r.PropertyAccessor.GetProperty($PROP_SMTP_DESTINATARIO)); if ($c) { return $c } } catch { }
  try {
    $eu = $r.AddressEntry.GetExchangeUser()
    if ($null -ne $eu) { $c = Casilla (Texto $eu.PrimarySmtpAddress); if ($c) { return $c } }
  } catch { }
  try { $c = Casilla (Texto $r.Address); if ($c) { return $c } } catch { }
  return ''
}

function LeerMail($m, [string]$carpeta, [string]$id, [string]$eid, $fecha) {
  $para = New-Object System.Collections.Generic.List[string]
  $cc = New-Object System.Collections.Generic.List[string]
  $cco = New-Object System.Collections.Generic.List[string]
  $adj = New-Object System.Collections.Generic.List[string]
  $sinResolver = 0
  try {
    $n = $m.Recipients.Count
    for ($i = 1; $i -le $n; $i++) {
      $r = $m.Recipients.Item($i)
      $a = DireccionDelDestinatario $r
      $tipo = 0
      try { $tipo = [int]$r.Type } catch { $tipo = 3 }
      # un grupo de correo (lista de Exchange 1, carpeta publica 2, lista de Outlook 11) no se abre desde aca: no se sabe
      # quien lo integra, asi que ese mail cuenta como "sin resolver" y no sube
      $esGrupo = $false
      try { $clase = [int]$r.AddressEntry.AddressEntryUserType; if ($clase -eq 1 -or $clase -eq 2 -or $clase -eq 11) { $esGrupo = $true } } catch { $esGrupo = $false }
      if ($esGrupo -or -not $a) { $sinResolver++ }
      elseif ($tipo -eq 1) { $para.Add($a) }
      elseif ($tipo -eq 3) { $cco.Add($a) }
      else { $cc.Add($a) }
    }
  } catch { $sinResolver++ }
  try {
    $n = $m.Attachments.Count
    for ($k = 1; $k -le $n; $k++) { $adj.Add((Texto $m.Attachments.Item($k).FileName)) }
  } catch { $sinResolver++ }
  $cuerpo = ''
  try { $cuerpo = Limpiar (Texto $m.Body) $MaxCuerpo } catch { $cuerpo = '' }
  $fechaTexto = ''
  if ($null -ne $fecha) { $fechaTexto = $fecha.ToString('yyyy-MM-dd HH:mm') }
  $de = ''; try { $de = Texto $m.SenderName } catch { }
  $paraTexto = ''; try { $paraTexto = Texto $m.To } catch { }
  $ccTexto = ''; try { $ccTexto = Texto $m.CC } catch { }
  $asunto = ''; try { $asunto = Texto $m.Subject } catch { }
  $conv = ''; try { $conv = Texto $m.ConversationID } catch { }
  # como lo marco quien lo mando: 0 normal, 1 personal, 2 privado, 3 confidencial. Si no se puede leer, no es normal.
  $reserva = 9; try { $reserva = [int]$m.Sensitivity } catch { $reserva = 9 }
  $deMail = DireccionDelRemitente $m
  $representa = DireccionDeQuienRepresenta $m
  # "en nombre de" otra persona sin que se pueda leer su casilla: el filtro no tiene contra que comparar
  $enNombreDe = ''; try { $enNombreDe = Texto $m.SentOnBehalfOfName } catch { }
  if ($enNombreDe -and $de -and ($enNombreDe -ne $de) -and (-not $representa)) { $sinResolver++ }
  return [ordered]@{
    t = 'mail'; id = $id; eid = $eid; carpeta = $carpeta; fecha = $fechaTexto
    de = $de; de_mail = $deMail; representa_mail = $representa
    para = $paraTexto; para_mails = $para.ToArray()
    cc = $ccTexto; cc_mails = $cc.ToArray(); cco_mails = $cco.ToArray()
    asunto = $asunto; adjuntos = $adj.ToArray(); conversacion = $conv
    cuerpo = $cuerpo; reserva = $reserva; sin_resolver = $sinResolver
  }
}

# La casilla del buzon principal (el que se lee), o '' si no se pudo saber.
function CasillaDelBuzon($ns) {
  try {
    $sid = [string]$ns.DefaultStore.StoreID
    $n = $ns.Accounts.Count
    for ($i = 1; $i -le $n; $i++) {
      $cuenta = $ns.Accounts.Item($i)
      $entrega = $null
      try { $entrega = $cuenta.DeliveryStore } catch { $entrega = $null }
      if ($null -ne $entrega -and ([string]$entrega.StoreID) -eq $sid) {
        $c = Casilla (Texto $cuenta.SmtpAddress)
        if ($c) { return $c }
      }
    }
  } catch { }
  try {
    $eu = $ns.CurrentUser.AddressEntry.GetExchangeUser()
    if ($null -ne $eu) { $c = Casilla (Texto $eu.PrimarySmtpAddress); if ($c) { return $c } }
  } catch { }
  try { $c = Casilla (Texto $ns.CurrentUser.Address); if ($c) { return $c } } catch { }
  return ''
}

# OJO: PowerShell no distingue mayusculas en los nombres: una variable $conocidos seria el parametro -Conocidos (texto).
# ---- la fecha de corte y lo ya subido ---------------------------------------------------------------
$corte = [datetime]::MinValue
if ($Desde) {
  try { $corte = [datetime]::ParseExact($Desde, 'yyyy-MM-ddTHH:mm:ss', [System.Globalization.CultureInfo]::InvariantCulture) }
  catch { Terminar 'error' 'la fecha de -Desde no es AAAA-MM-DDTHH:MM:SS' 1 }
}
$yaVistos = New-Object 'System.Collections.Generic.HashSet[string]'
if ($Conocidos -and (Test-Path -LiteralPath $Conocidos)) {
  try { foreach ($ln in [System.IO.File]::ReadAllLines($Conocidos, $script:Utf8)) { if ($ln) { [void]$yaVistos.Add($ln) } } } catch { }
}

# ---- engancharse al Outlook clasico que ya esta abierto (no se arranca ni se cierra) ------------------
if ($env:CLAUDE_AREA_SIN_OUTLOOK) { Terminar 'cerrado' 'Outlook clasico no esta abierto' 4 }
$hayNuevo = @(Get-Process -Name 'olk' -ErrorAction SilentlyContinue).Count -gt 0
if (-not (Test-Path -LiteralPath 'Registry::HKEY_CLASSES_ROOT\Outlook.Application')) {
  if ($hayNuevo) { Terminar 'nuevo' 'esta abierto el Outlook nuevo; hace falta el clasico' 4 } else { Terminar 'no_instalado' 'esta PC no tiene Outlook clasico' 4 }
}
if (@(Get-Process -Name 'OUTLOOK' -ErrorAction SilentlyContinue).Count -eq 0) {
  if ($hayNuevo) { Terminar 'nuevo' 'esta abierto el Outlook nuevo; hace falta el clasico' 4 } else { Terminar 'cerrado' 'Outlook clasico no esta abierto' 4 }
}
$outlook = $null
try { $outlook = [System.Runtime.InteropServices.Marshal]::GetActiveObject('Outlook.Application') } catch { $outlook = $null }
if ($null -eq $outlook) { Terminar 'no_responde' 'Outlook esta abierto pero no responde' 4 }
$ns = $null
try { $ns = $outlook.GetNamespace('MAPI') } catch { Terminar 'no_responde' 'Outlook no deja leer el buzon' 4 }

# Las carpetas que no se leen nunca tienen que poder identificarse TODAS: si una falla, no se lee nada.
$fuera = New-Object 'System.Collections.Generic.HashSet[string]'
foreach ($k in $CARPETAS_FUERA) {
  $idCarpeta = ''
  try { $idCarpeta = [string]$ns.GetDefaultFolder($k).EntryID } catch { $idCarpeta = '' }
  if (-not $idCarpeta) { Terminar 'no_responde' ('Outlook no pudo decir cual es la carpeta ' + $k + ' (eliminados, salida, borradores o no deseado): no leo nada') 4 }
  [void]$fuera.Add($idCarpeta)
}
foreach ($k in $CARPETAS_FUERA_SI_ESTAN) { try { [void]$fuera.Add([string]$ns.GetDefaultFolder($k).EntryID) } catch { } }

$revisados = 0
$fallados = 0
$ultimoLatido = 0.0
$completa = $true
$raiz = $null
try { $raiz = $ns.DefaultStore.GetRootFolder() } catch { Terminar 'no_responde' 'no pude abrir el buzon principal' 4 }
Renglon ([ordered]@{ t = 'buzon'; casilla = (CasillaDelBuzon $ns) })
$pila = New-Object System.Collections.Stack
$pila.Push(@($raiz, ''))
try {
  while ($pila.Count -gt 0 -and $completa) {
    $par = $pila.Pop()
    $carpeta = $par[0]
    $ruta = [string]$par[1]
    $nombre = ''
    try {
      if ($fuera.Contains([string]$carpeta.EntryID)) { continue }
      $nombre = [string]$carpeta.Name
    } catch { continue }
    if ($NOMBRES_FUERA -contains (SinTildes $nombre)) { continue }
    $p = $nombre
    if ($ruta) { $p = $ruta + ' / ' + $nombre }
    $esDeMails = $true
    try { $esDeMails = ($carpeta.DefaultItemType -eq 0) } catch { $esDeMails = $false }
    if ($esDeMails) {
      $items = $null
      $n = 0
      $ordenado = $true
      try {
        $items = $carpeta.Items
        try { $items.Sort('[ReceivedTime]', $true) } catch { $ordenado = $false }
        $n = $items.Count
      } catch { $n = 0 }
      for ($i = 1; $i -le $n; $i++) {
        if ($script:Reloj.Elapsed.TotalSeconds -gt $MaxSegundos) { $completa = $false; break }
        if (($script:Reloj.Elapsed.TotalSeconds - $ultimoLatido) -gt 10) { $ultimoLatido = $script:Reloj.Elapsed.TotalSeconds; Renglon ([ordered]@{ t = 'latido'; revisados = $revisados }) }
        $revisados++
        $m = $null
        try {
          $m = $items.Item($i)
          if ($m.Class -ne 43) { continue }
          $salio = $true
          try { $salio = [bool]$m.Sent } catch { $salio = $true }
          if (-not $salio) { continue }
          $rt = $null
          try { $rt = [datetime]$m.ReceivedTime } catch { $rt = $null }
          if ($null -ne $rt -and $rt -lt $corte) {
            if ($ordenado) { break }
            continue
          }
          $id = ''
          try { $id = Texto $m.PropertyAccessor.GetProperty($PROP_ID_INTERNET) } catch { $id = '' }
          $eid = ''
          try { $eid = Texto $m.EntryID } catch { $eid = '' }
          if (-not $id) { $id = 'eid:' + $eid }
          $id = ($id -replace '[\r\n]+', ' ').Trim()
          if ($yaVistos.Contains($id)) { continue }
          [void]$yaVistos.Add($id)
          Renglon (LeerMail $m $p $id $eid $rt)
          # Outlook atiende estos pedidos en el mismo hilo que la pantalla de la persona: una pausa corta por mail
          # para que no lo sienta pesado mientras trabaja.
          if ($PausaMs -gt 0) { Start-Sleep -Milliseconds $PausaMs }
        } catch { $fallados++ }
        finally { if ($null -ne $m) { try { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($m) } catch { } } }
      }
    }
    try {
      $cuantas = $carpeta.Folders.Count
      for ($j = 1; $j -le $cuantas; $j++) { $pila.Push(@($carpeta.Folders.Item($j), $p)) }
    } catch { }
  }
} catch {
  Renglon ([ordered]@{ t = 'estado'; estado = 'error'; detalle = ([string]$_.Exception.Message) })
  Renglon ([ordered]@{ t = 'fin'; completa = $false; revisados = $revisados })
  exit 1
}
Renglon ([ordered]@{ t = 'fin'; completa = $completa; revisados = $revisados; fallados = $fallados })
exit 0
