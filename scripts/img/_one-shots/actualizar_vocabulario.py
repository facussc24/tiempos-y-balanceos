# -*- coding: utf-8 -*-
with open(r"c:\Dev\BarackMercosul\scripts\img\generar_hojas_img.py", "r", encoding="utf-8") as f:
    text = f.read()

# 1. Purga de izaje en 30.10
text = text.replace(
    "Enhebrar las 4 cadenas de izaje con grilletes de seguridad certificados en los 4 cáncamos giratorios (Swivel Hoist Rings 1000-06-00, par de apriete 470 Nm).",
    "Enganchar las 4 cadenas con grilletes de seguridad a los cáncamos giratorios del molde (Swivel Hoist Rings 1000-06-00, torque 470 Nm)."
)

text = text.replace(
    "El cambio de molde debe ser ejecutado por personal capacitado de Producción siguiendo estrictas normas de seguridad de izaje.",
    "El cambio de molde debe ser realizado por personal de Producción respetando las normas de seguridad para maniobras con el puente grúa."
)

text = text.replace(
    "disparador='SI DETECTA ANOMALÍA EN ELEMENTOS DE IZAJE O INTERFERENCIA',",
    "disparador='SI DETECTA ANOMALÍA EN CADENAS, GRÚA O INTERFERENCIA',"
)

text = text.replace(
    '"1. Detener inmediatamente la maniobra de elevación.",',
    '"1. Detener inmediatamente el puente grúa.",'
)

text = text.replace(
    '"2. Verificar el equilibrado de las 4 ramales de cadena y anclajes.",',
    '"2. Verificar que las 4 cadenas tiren parejo y no rocen la estructura.",'
)

text = text.replace(
    '"3. Dar aviso al Líder de Producción antes de reiniciar el izaje."',
    '"3. Dar aviso al Líder de Producción antes de continuar con la maniobra."'
)

# 2. Purga en 30.9: cajón de scrap
text = text.replace(
    "Segregar de inmediato e identificar en el contenedor rojo cualquier pieza que presente arrugas, quemaduras o pliegues no conformes.",
    "Segregar de inmediato al cajón de scrap / contenedor rojo cualquier pieza que presente arrugas, quemaduras o pliegues no conformes."
)

# 3. Purga en 30.12: topes rojos Kip
text = text.replace(
    "▲ ADVERTENCIA TÉCNICA DEL FABRICANTE: Estos topes rojos son EXCLUSIVAMENTE para transporte y despacho. Deben ser retirados y guardados en lugar seguro antes de ingresar el molde a producción.",
    "▲ ADVERTENCIA TÉCNICA DEL FABRICANTE: Estos topes rojos son ÚNICAMENTE para transporte y flete fuera de planta. Deben ser retirados y guardados en lugar seguro antes de montar el molde para producción."
)

with open(r"c:\Dev\BarackMercosul\scripts\img\generar_hojas_img.py", "w", encoding="utf-8") as f:
    f.write(text)

print("Vocabulario 100% actualizado en generar_hojas_img.py")
