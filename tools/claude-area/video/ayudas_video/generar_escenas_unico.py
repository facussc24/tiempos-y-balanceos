#!/usr/bin/env python
# Arma escenas_unico.json (UN solo video) a partir de escenas_v3.json (tutorial) y escenas_ilusiona.json (por sector).
# Los dos .json de origen quedan intactos: aca solo se leen.
#
# Pedido de Facundo (04/10/2026): un solo video, con la voz mas lenta, y SIN las tarjetas de archivo editado
# (« mail_borrador.json  Deshacer +7 -0 », « Guardado 2 memorias, creado SKILL.md +29 -0 », « SKILL.md  Deshacer +29 -0 »),
# porque en la practica eso no se hace. No se retoca ninguna pantalla: solo se elige QUE PARTE de la grabacion real se ve
# (otro tramo de la grabacion o una ventana de camara mas chica que deja la tarjeta afuera).
#
# Los 21 parrafos son los de .sgc-cache/claude-por-area/examen/video_unico_narracion.txt (copiado a voz_unico/narracion.txt):
#   1-4 apertura, menu Inicio, botones, carpeta · 5-6 las dos preguntas de Produccion · 7 «Cada sector tiene sus preguntas»
#   8-13 Calidad, Logistica, Compras, Mantenimiento, RRHH, Direccion · 14 mail · 15 presentacion · 16 ensenar una tarea
#   17 Ingenieria y el arb · 18 modelo y esfuerzo · 19 lo que no hace solo · 20-21 cierre.
import copy
import json
import pathlib

VID = pathlib.Path(__file__).resolve().parents[1]
v3 = json.loads((VID / "escenas_v3.json").read_text(encoding="utf-8"))
il = json.loads((VID / "escenas_ilusiona.json").read_text(encoding="utf-8"))


def de_v3(n):
    return copy.deepcopy(next(e for e in v3["escenas"] if e["numero"] == n))


def de_il(n):
    return copy.deepcopy(next(e for e in il["escenas"] if e["numero"] == n))


def voz(escena, nuevas):
    """Cambia el 'voz' de cada toma de la escena, en orden."""
    assert len(nuevas) == len(escena["tomas"]), (escena["titulo"], len(nuevas), len(escena["tomas"]))
    for tm, v in zip(escena["tomas"], nuevas):
        tm["voz"] = v


escenas = []

# 1-2: apertura, menu Inicio, boton Code, carpeta (parrafos 1 a 4: los mismos que en el tutorial)
e = de_v3(1)
escenas.append(e)
e = de_v3(2)
escenas.append(e)

# 3: decirle el puesto (parrafo 5 = antes 5 y 6 juntos)
e = de_v3(3)
e["parrafos"] = [5]
voz(e, [["5"]])
escenas.append(e)

# 4: la pregunta de las tres piezas (parrafo 6 = antes 7 y 8 juntos). Alcanza con esta para Produccion.
e = de_v3(4)
e["parrafos"] = [6]
voz(e, [["6:1"], ["6:2-5"]])
escenas.append(e)

# 5: puente «Cada sector tiene sus preguntas» (parrafo 7)
escenas.append({
    "numero": 0, "titulo": "Cada sector tiene sus preguntas", "parrafos": [7],
    "tomas": [{
        "voz": ["7"], "recurso": "lamina", "texto_en_pantalla": "",
        "que_tiene_que_verse": "Lamina de texto: «Cada sector tiene sus preguntas» y los seis sectores que vienen.",
        "lamina": {"titulo": "Cada sector tiene sus preguntas",
                   "renglones": ["Calidad · Logística · Compras", "Mantenimiento · Recursos Humanos · Dirección"]},
    }],
})

# 6-11: los seis sectores (parrafos 8 a 13; en el video por sector eran 3 a 8)
for n in (3, 4, 5, 6, 7, 8):
    e = de_il(n)
    e["parrafos"] = [n + 5]
    for tm in e["tomas"]:
        tm["voz"] = [str(int(v) + 5) for v in tm["voz"]]
    escenas.append(e)

# 12: el mail (parrafo 14 = antes 9 y 10 juntos). SIN la tarjeta mail_borrador.json: las ventanas de camara de las
# grabaciones «mandalo» y «listo» empiezan debajo de la tarjeta (en esas grabaciones esta entre y = 355 y y = 383).
e = de_v3(5)
e["parrafos"] = [14]
voz(e, [["14:1"], ["14:2", "14:3"], ["14:4"]])
t3 = e["tomas"][2]
t3["que_tiene_que_verse"] = ("El mail con el boton Enviar marcado; despues «mandalo» escrito en Claude y, al final, «Listo: salio a "
                            "Facundo Santoro...». La ventana empieza debajo de la tarjeta del borrador: no se ve.")
tr = t3["tramos"]
assert tr[0]["desde"] == 2.5 and tr[0]["hasta"] == 4.5
tr[0]["hasta"] = 4.4          # a los 4,5 s de esa grabacion ya se asoma la ventana de Claude con la tarjeta
assert tr[1]["recurso"].endswith("mail-mandalo.mp4") and tr[2]["recurso"].endswith("mail-listo.mp4")
tr[1]["camara"] = [{"x": 0, "y": 392, "ancho": 680, "alto": 210}]
tr[2]["camara"] = [{"x": 0, "y": 392, "ancho": 676, "alto": 198}]
escenas.append(e)

# 13: la presentacion (parrafo 15 = antes 11). Se corre el tramo de espera un poco, para que no asome «Creando presentacion.json».
e = de_v3(6)
e["parrafos"] = [15]
voz(e, [["15:1"], ["15:2"]])
t2 = e["tomas"][1]["tramos"][0]
assert t2["desde"] == 3.9 and t2["hasta"] == 5.9
t2["desde"], t2["hasta"] = 4.2, 6.2
escenas.append(e)

# 14: ensenarle una tarea (parrafo 16 = antes 12). La grabacion del guardado trae, desde los 10 s, «Guardado 2 memorias,
# creado SKILL.md +29 -0» y despues la tarjeta «SKILL.md Deshacer +29 -0». Se muestra la respuesta de la persona («si guardalo
# asi», primeros 1,9 s) y, de los 13,2 s en adelante, solo el renglon «Listo, la deje guardada...» con una ventana
# de 48 px de alto (y = 189 a 237), debajo de la linea gris del guardado y arriba de la tarjeta.
e = de_v3(7)
e["parrafos"] = [16]
voz(e, [["16:1-2"], ["16:3"]])
t2 = e["tomas"][1]
t2["que_tiene_que_verse"] = ("La persona dice que si («si guardalo asi») y Claude contesta «Listo, la deje guardada». "
                            "Solo se ve ese renglon: la tarjeta del archivo y la linea del guardado quedan afuera.")
t2["tramos"] = [
    {"desde": 0.0, "hasta": 1.9, "dura": 2.0, "etiqueta": "", "camara": [{"x": 0, "y": 40, "ancho": 680}]},
    {"desde": 13.2, "hasta": 15.4, "camara": [{"x": 0, "y": 189, "ancho": 680, "alto": 48}],
     "recuadros": [{"que_marca": "Listo, la dejé guardada", "x": 1.5, "y": 57.2, "ancho": 97.0, "alto": 9.2, "con_la_palabra": "igual"}]},
]
escenas.append(e)

# 15: Ingenieria y el arb (parrafo 17 = antes 13)
e = de_v3(8)
e["parrafos"] = [17]
voz(e, [["17:1"], ["17:2"], ["17:3"], ["17:4"]])
escenas.append(e)

# 16: modelo y esfuerzo (parrafo 18 = antes 14)
e = de_v3(9)
e["parrafos"] = [18]
voz(e, [["18:1-3"], ["18:4"]])
escenas.append(e)

# 17: lo que no hace solo (parrafo 19 = antes 15 y 16, sin la frase del correo). La lamina dice lo mismo que la voz: tres renglones.
e = de_v3(10)
e["parrafos"] = [19]
voz(e, [["19"]])
reng = e["tomas"][0]["lamina"]["renglones"]
assert reng[3]["texto"].startswith("No muestra mails")
del reng[3]          # decision de Facundo (04/10): no se nombra el correo de nadie; la voz tiene 3 frases y la lamina 3 renglones
assert [r["texto"] for r in reng] == ["No borra archivos si no se lo pedís", "No manda mails si no se lo pedís", "No cambia nada en el servidor"]
e["tomas"][0]["que_tiene_que_verse"] = "Lamina de texto: lo que Claude no hace solo, un renglon por cada cosa que dice la voz (tres)."
escenas.append(e)

# 18: cierre (parrafos 20 y 21 = antes 17 y 18)
e = de_v3(11)
e["parrafos"] = [20, 21]
voz(e, [["20", "21"]])
escenas.append(e)

for i, e in enumerate(escenas, 1):
    e["numero"] = i

out = {
    "_como_se_usa": list(v3["_como_se_usa"]) + [
        "VIDEO UNICO (04/10/2026): junta el tutorial (version 3) y el video por sector en uno solo, con la voz mas lenta (voz_unico: "
        "--lentitud 1.30 --pausa-frase 0.6) y sin las tarjetas de archivo editado (mail_borrador.json +7 -0, SKILL.md +29 -0, «Deshacer»). "
        "Las tarjetas se sacan de cuadro eligiendo otro tramo de la grabacion o una ventana de 'camara' con 'alto' que las deja afuera: "
        "no se retoca ninguna pantalla. Sale de ayudas_video/generar_escenas_unico.py.",
    ],
    "video": {
        "salida": "../../../exports/CLAUDES_POR_AREA_20261001/Video - Claude en Barack.mp4",
        "voz": "../../../exports/CLAUDES_POR_AREA_20261001/fuentes/voz_unico",
        "logo": v3["video"]["logo"],
        "placa_apertura": {"titulo": "Claude en Barack", "frase": "Cómo se usa", "segundos": 1.7},
        "placa_final": copy.deepcopy(v3["video"]["placa_final"]),
    },
    "ajustes": dict(v3["ajustes"], pausa_entre_parrafos_s=0.9, aire_de_escena_s=0.6, duracion_minima_s=200, duracion_maxima_s=340),
    "escenas": escenas,
}
destino = VID / "escenas_unico.json"
destino.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("escrito", destino, len(escenas), "escenas")
