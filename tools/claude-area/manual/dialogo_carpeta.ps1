# Abre el cuadro de Windows "elegir carpeta" (el mismo que abre la app cuando se aprieta el boton de la carpeta),
# parado en -Donde y con -Nombre escrito en el casillero, le saca la captura y lo cierra con Cancelar.
# El cuadro es de ESTE programa: no toca la app ni elige nada. Solo ASCII en este archivo.
# Uso: powershell -File dialogo_carpeta.ps1 -Salida <archivo.png> [-Donde C:\] [-Nombre ClaudeBarack]
#      (uso interno) -Mostrar: abre el cuadro y espera; lo llama este mismo programa en segundo plano.
param([string]$Salida = '', [string]$Donde = 'C:\', [string]$Nombre = 'ClaudeBarack', [switch]$Mostrar)
Add-Type @'
using System;
using System.Runtime.InteropServices;
[ComImport, Guid("DC1C5A9C-E88A-4dde-A5A1-60F82A20AEF7")] class FileOpenDialogRCW { }
[ComImport, Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IShellItem { }
[ComImport, Guid("42f85136-db7e-439c-85f1-e4075d135fc8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IFileDialog {
  [PreserveSig] int Show(IntPtr dueno);
  void SetFileTypes(uint n, IntPtr tipos);
  void SetFileTypeIndex(uint i);
  void GetFileTypeIndex(out uint i);
  void Advise(IntPtr p, out uint cookie);
  void Unadvise(uint cookie);
  void SetOptions(uint o);
  void GetOptions(out uint o);
  void SetDefaultFolder(IShellItem i);
  void SetFolder(IShellItem i);
  void GetFolder(out IShellItem i);
  void GetCurrentSelection(out IShellItem i);
  void SetFileName([MarshalAs(UnmanagedType.LPWStr)] string n);
  void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string n);
  void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string t);
}
public static class Cuadro {
  [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
  static extern void SHCreateItemFromParsingName(string ruta, IntPtr ctx, [In] ref Guid iid, [MarshalAs(UnmanagedType.Interface)] out IShellItem item);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int a, bool repintar);
  public static void Mostrar(string donde, string nombre) {
    IFileDialog d = (IFileDialog)new FileOpenDialogRCW();
    uint o; d.GetOptions(out o); d.SetOptions(o | 0x20u);   // 0x20 = elegir carpetas
    Guid iid = new Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE"); IShellItem it;
    SHCreateItemFromParsingName(donde, IntPtr.Zero, ref iid, out it);
    d.SetFolder(it);
    if (!string.IsNullOrEmpty(nombre)) d.SetFileName(nombre);
    d.Show(IntPtr.Zero);
  }
}
'@
if ($Mostrar) { [Cuadro]::Mostrar($env:DC_DONDE, $env:DC_NOMBRE); exit 0 }
if (-not $Salida) { Write-Output 'falta -Salida'; exit 1 }
$aqui = $PSScriptRoot
# la carpeta y el nombre viajan por variables de entorno: "C:\" como argumento se come la comilla de cierre
$env:DC_DONDE = $Donde; $env:DC_NOMBRE = $Nombre
$p = Start-Process powershell -PassThru -WindowStyle Hidden -ArgumentList @('-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"", '-Mostrar')
$h = [IntPtr]::Zero
for ($i = 0; $i -lt 40 -and $h -eq [IntPtr]::Zero; $i++) {
  Start-Sleep -Milliseconds 250
  $p.Refresh()
  if ($p.HasExited) { Write-Output 'el cuadro se cerro solo'; exit 1 }
  $h = $p.MainWindowHandle
}
if ($h -eq [IntPtr]::Zero) { Write-Output 'el cuadro no aparecio'; Stop-Process -Id $p.Id -Force; exit 1 }
Write-Output ("cuadro: " + $p.MainWindowTitle)
[void][Cuadro]::MoveWindow($h, 200, 120, 1100, 640, $true)
Start-Sleep -Seconds 2
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $aqui 'capturar.ps1') -Salida $Salida -Titulo $p.MainWindowTitle -DeLaVentana
[void][Cuadro]::PostMessage($h, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)   # WM_CLOSE = Cancelar
Start-Sleep -Milliseconds 800
$p.Refresh(); if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force }
Write-Output 'cuadro cerrado sin elegir nada'
