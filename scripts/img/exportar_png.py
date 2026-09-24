# -*- coding: utf-8 -*-
"""
Exportador de diapositivas de PowerPoint a PNG (2000 px de ancho, alto segun la lamina)
utilizando la interfaz COM de Microsoft PowerPoint.

    py -3 exportar_png.py                          # el deck de las hojas 31 a 37
    py -3 exportar_png.py "<deck.pptx>" "<carpeta>"  # cualquier otro deck
"""
import os
import sys
import win32com.client

PPTX_IMG = r"c:\Dev\BarackMercosul\scripts\img\HOJAS DE PROCESO - MAQUINA IMG.pptx"
RENDER_IMG = r"c:\Dev\BarackMercosul\scripts\img\render_deck_img"


def exportar(pptx_path=PPTX_IMG, out_dir=RENDER_IMG, ancho=2000):
    """py -3 exportar_png.py ["<deck.pptx>" "<carpeta de salida>"]  (sin argumentos: el deck IMG)"""
    pptx_path = os.path.abspath(pptx_path)
    out_dir = os.path.abspath(out_dir)
    os.makedirs(out_dir, exist_ok=True)

    print(f"Abriendo PowerPoint para exportar: {pptx_path}")
    ppt = win32com.client.Dispatch("PowerPoint.Application")
    # Si Fak tiene una presentacion abierta, PowerPoint no se cierra: el 23/09 un Quit()
    # le cerro el deck que le acababa de abrir para mirar.
    habia_abiertas = ppt.Presentations.Count
    try:
        # Abrir presentación en modo oculto / sin ventana principal
        pres = ppt.Presentations.Open(pptx_path, WithWindow=False)
        total = pres.Slides.Count
        print(f"Total de diapositivas detectadas: {total}")

        # Limpiar diapositivas viejas que superen el nuevo total (ej. Diapositiva13)
        for fname in os.listdir(out_dir):
            if fname.startswith("Diapositiva") and fname.endswith(".PNG"):
                try:
                    num = int(fname.replace("Diapositiva", "").replace(".PNG", ""))
                    if num > total:
                        os.remove(os.path.join(out_dir, fname))
                        print(f"Eliminada diapositiva sobrante obsoleta: {fname}")
                except Exception:
                    pass

        # el alto sale de la lamina: 1920x1080 es 16:9 y un A4 apaisado es 1,41:1
        alto = int(round(ancho * pres.PageSetup.SlideHeight / pres.PageSetup.SlideWidth))
        for i, slide in enumerate(pres.Slides):
            out_file = os.path.join(out_dir, f"Diapositiva{i+1}.PNG")
            slide.Export(out_file, "PNG", ancho, alto)
            print(f"  [OK] Exportada Diapositiva {i+1}/{total} -> {os.path.basename(out_file)}")

        pres.Close()
    finally:
        if habia_abiertas == 0 and ppt.Presentations.Count == 0:
            ppt.Quit()

    print("\nExportación completada con éxito.")

if __name__ == "__main__":
    exportar(*sys.argv[1:3])
