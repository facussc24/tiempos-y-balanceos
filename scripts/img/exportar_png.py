# -*- coding: utf-8 -*-
"""
Exportador oficial de diapositivas de PowerPoint a PNG en alta resolución (1920x1080)
utilizando la interfaz COM de Microsoft PowerPoint.
"""
import os
import sys
import win32com.client

def exportar():
    pptx_path = os.path.abspath(r"c:\Dev\BarackMercosul\scripts\img\HOJAS DE PROCESO - MAQUINA IMG.pptx")
    out_dir = os.path.abspath(r"c:\Dev\BarackMercosul\scripts\img\render_deck_img")
    os.makedirs(out_dir, exist_ok=True)

    print(f"Abriendo PowerPoint para exportar: {pptx_path}")
    ppt = win32com.client.Dispatch("PowerPoint.Application")
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

        for i, slide in enumerate(pres.Slides):
            out_file = os.path.join(out_dir, f"Diapositiva{i+1}.PNG")
            slide.Export(out_file, "PNG", 1920, 1080)
            print(f"  [OK] Exportada Diapositiva {i+1}/{total} -> {os.path.basename(out_file)}")

        pres.Close()
    finally:
        ppt.Quit()

    print("\nExportación completada con éxito.")

if __name__ == "__main__":
    exportar()
