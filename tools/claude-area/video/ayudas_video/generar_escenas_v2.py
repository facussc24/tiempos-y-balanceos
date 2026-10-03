#!/usr/bin/env python
# Arma escenas_v2.json a partir de escenas.json (v1 intacto): corre los parrafos y cambia/agrega las escenas con grabacion real.
import copy, json, pathlib

VID = pathlib.Path(r"C:\Dev\BarackMercosul\tools\claude-area\video")
v1 = json.loads((VID / "escenas.json").read_text(encoding="utf-8"))
esc1 = {e["numero"]: e for e in v1["escenas"]}

T = "tomas/"
PEDIDO_TRES = T + "demo-02oct-tres-piezas-responde.mp4"
MAIL_PEDIDO = T + "demo-02oct-mail-pedido.mp4"
MAIL_ABRE = T + "demo-02oct-mail-se-abre.mp4"
MAIL_MANDALO = T + "demo-02oct-mail-mandalo.mp4"
MAIL_LISTO = T + "demo-02oct-mail-listo.mp4"
PRES_PEDIDO = T + "demo-02oct-presentacion-pedido.mp4"
PRES_PPT = T + "demo-02oct-presentacion-powerpoint.mp4"
APR_PROPONE = T + "demo-02oct-aprende-propone.mp4"
APR_GUARDADO = T + "demo-02oct-aprende-guardado.mp4"

out = {}
out["_como_se_usa"] = list(v1["_como_se_usa"]) + [
    "VERSION 2 (02/10/2026): igual que el video de siempre pero con grabaciones reales (la prueba hecha en una PC de Produccion). Los recortes estan en tomas/demo-02oct-*.mp4 y los saca recortar_demo_v2.py de la grabacion cruda (que no esta en el repositorio). Cada recorte ya viene cortado a la zona que se puede mostrar.",
    "  tramos: una toma con grabacion puede traer 'tramos' (lista, en el orden en que se ven). Cada uno: 'recurso' (si no es el de la toma), 'desde' y 'hasta' (segundos de ESA grabacion) y cuanto dura: 'velocidad', 'dura', 'hasta_palabra' (+ 'ocurrencia', 'mas') o 'hasta_frase'; el ultimo llena lo que queda. Entre un tramo y otro puede haber un corte: asi se saca la espera. Desde 1,8x aparece el cartel «Acelerado ×N» (o el texto de 'etiqueta').",
    "  recuadros en una grabacion: dentro de un tramo, en porcentaje del cuadro de ESA grabacion; entran con la voz ('con_la_palabra' o 'con_la_frase') y valen mientras ese tramo se ve.",
    "  ajustes.duracion_minima_s y duracion_maxima_s: el rango que controla el archivo terminado (por defecto 105 y 140).",
    "  camara (en un tramo de grabacion): lista de vistas {x, y, ancho} en PIXELES de la grabacion (el alto sale solo). La grabacion se lee a su tamaño real y la pantalla muestra solo esa ventana, ocupando todo el ancho del area: sirve para leer una conversacion (la columna de texto) en un proyector o en un celular. La primera vista es la de partida; cada otra entra con 't' (segundos desde el principio del tramo) o con 'con_la_palabra' / 'con_la_frase' y se alcanza con un desplazamiento suave de 'mov' segundos (0,9 por defecto). Los recuadros de ese tramo siguen en porcentaje de la grabacion entera.",
]
out["video"] = dict(v1["video"])
out["video"]["salida"] = "../../../exports/CLAUDES_POR_AREA_20261001/Video tutorial - Claude en Barack (version 2).mp4"
out["video"]["voz"] = "../../../exports/CLAUDES_POR_AREA_20261001/fuentes/voz_v2"
out["ajustes"] = dict(v1["ajustes"])
out["ajustes"]["duracion_minima_s"] = 105
out["ajustes"]["duracion_maxima_s"] = 170

escenas = []

# --- 1 a 3: iguales (parrafos 1 a 6)
for n in (1, 2, 3):
    escenas.append(copy.deepcopy(esc1[n]))

# --- 4: la pregunta real, con la grabacion
escenas.append({
    "numero": 4, "titulo": "Pregunta real y su fuente", "parrafos": [7, 8],
    "tomas": [
        {"voz": ["7"], "recurso": PEDIDO_TRES, "texto_en_pantalla": "3 · Preguntar", "escala_maxima": 1.7,
         "que_tiene_que_verse": "La pregunta de las tres piezas ya enviada y Claude buscando en los procedimientos (acelerado).",
         "tramos": [{"desde": 0.4, "hasta": 35.0, "camara": [{"x": 0, "y": 0, "ancho": 680}]}]},
        {"voz": ["8"], "recurso": PEDIDO_TRES, "texto_en_pantalla": "3 · Preguntar", "escala_maxima": 1.7,
         "que_tiene_que_verse": "La respuesta que aparece con la lista de pasos y, al final, el renglon Fuentes con el documento y la revision (P-09.1 rev B.1).",
         "tramos": [
             {"desde": 35.0, "hasta": 37.7, "hasta_frase": 2, "camara": [{"x": 0, "y": 0, "ancho": 680}]},
             {"desde": 38.0, "hasta": 48.2,
              "camara": [{"x": 0, "y": 0, "ancho": 680},
                         {"con_la_frase": 2, "x": 0, "y": 176, "ancho": 680, "mov": 0.8}],
              "recuadros": [
                  {"que_marca": "las fuentes: documento y revision", "x": 2.0, "y": 83.0, "ancho": 73.0, "alto": 15.0,
                   "con_la_palabra": "sacó"},
                  {"que_marca": "P-09.1, revision B.1", "x": 6.0, "y": 89.0, "ancho": 66.0, "alto": 4.8,
                   "con_la_palabra": "revisión"}]}]},
    ]})

# --- 5: el mail, con la grabacion
escenas.append({
    "numero": 5, "titulo": "Pedido de mail", "parrafos": [9, 10],
    "tomas": [
        {"voz": ["9:1"], "recurso": MAIL_PEDIDO, "texto_en_pantalla": "Pedir un mail", "escala_maxima": 1.7,
         "que_tiene_que_verse": "El pedido «Armame un mail para...» ya enviado.",
         "tramos": [{"desde": 0.2, "hasta": 2.2, "camara": [{"x": 0, "y": 0, "ancho": 680}]}]},
        {"voz": ["9:2", "10:1"], "recurso": MAIL_PEDIDO, "texto_en_pantalla": "Pedir un mail", "escala_maxima": 1.7,
         "que_tiene_que_verse": "Claude abriendo el borrador y, cuando la voz dice Outlook, la ventana de Outlook con el mail armado.",
         "tramos": [
             {"desde": 36.0, "hasta": 38.8, "hasta_palabra": "Outlook", "mas": -0.05, "etiqueta": "Espera acortada",
              "camara": [{"x": 0, "y": 0, "ancho": 680}]},
             {"recurso": MAIL_ABRE, "desde": 0.5, "hasta": 2.5,
              "camara": [{"x": 0, "y": 0, "ancho": 1148},
                         {"con_la_frase": 2, "x": 0, "y": 130, "ancho": 800}]}]},
        {"voz": ["10:2"], "recurso": MAIL_ABRE, "texto_en_pantalla": "Pedir un mail", "escala_maxima": 1.4,
         "segundos_extra": 2.6,
         "que_tiene_que_verse": "El mail con el boton Enviar marcado; despues «mandalo» escrito en Claude y, al final, «Listo: salio a Facundo Santoro...».",
         "tramos": [
             {"desde": 2.5, "hasta": 4.5, "hasta_palabra": "mandalo", "mas": -0.05,
              "camara": [{"x": 0, "y": 130, "ancho": 800}],
              "recuadros": [{"que_marca": "el boton Enviar", "x": 2.6, "y": 26.0, "ancho": 6.2, "alto": 14.5,
                             "con_la_palabra": "Enviar"}]},
             {"recurso": MAIL_MANDALO, "desde": 0.15, "hasta": 2.0, "hasta_palabra": "él", "mas": -0.05,
              "camara": [{"x": 0, "y": 308, "ancho": 680}]},
             {"recurso": MAIL_LISTO, "desde": 0.9, "hasta": 4.3, "fundido": 0,
              "camara": [{"x": 0, "y": 298, "ancho": 676}],
              "recuadros": [{"que_marca": "Listo: salio a Facundo Santoro", "x": 2.0, "y": 86.5, "ancho": 96.0, "alto": 8.5}]}]},
    ]})

# --- 6: presentaciones (nueva)
escenas.append({
    "numero": 6, "titulo": "Armar una presentación", "parrafos": [11],
    "tomas": [
        {"voz": ["11:1"], "recurso": PRES_PEDIDO, "texto_en_pantalla": "Armar una presentación", "escala_maxima": 1.7,
         "que_tiene_que_verse": "El pedido «Armame una presentacion de 3 hojas...» ya enviado.",
         "tramos": [{"desde": 0.3, "hasta": 2.4, "camara": [{"x": 0, "y": 0, "ancho": 680}]}]},
        {"voz": ["11:2"], "recurso": PRES_PEDIDO, "texto_en_pantalla": "Armar una presentación", "escala_maxima": 1.7,
         "segundos_extra": 2.0,
         "que_tiene_que_verse": "Claude armando la presentacion y PowerPoint abierto con las diapositivas, cada una con su fuente al pie.",
         "tramos": [
             {"desde": 3.9, "hasta": 5.9, "hasta_palabra": "PowerPoint", "mas": -0.1, "etiqueta": "Espera acortada",
              "camara": [{"x": 0, "y": 0, "ancho": 680}]},
             {"recurso": PRES_PPT, "desde": 2.1, "hasta": 4.9,
              "camara": [{"x": 0, "y": 0, "ancho": 1767},
                         {"con_la_palabra": "fuente", "x": 240, "y": 50, "ancho": 1560, "mov": 0.9}],
              "recuadros": [{"que_marca": "la fuente al pie de la hoja", "x": 26.5, "y": 89.0, "ancho": 41.0, "alto": 5.5,
                             "con_la_palabra": "pie", "foco": False}]}]},
    ]})

# --- 7: ensenarle una tarea (nueva)
escenas.append({
    "numero": 7, "titulo": "Enseñarle una tarea", "parrafos": [12],
    "tomas": [
        {"voz": ["12:1-2"], "recurso": APR_PROPONE, "texto_en_pantalla": "Enseñarle una tarea", "escala_maxima": 1.7,
         "que_tiene_que_verse": "El pedido «Aprende como armo el parte de fin de turno...» y Claude mostrando como quedaria la habilidad: «¿La guardo asi?».",
         "tramos": [
             {"desde": 0.2, "hasta": 1.5, "hasta_frase": 2, "camara": [{"x": 0, "y": 0, "ancho": 680}]},
             {"desde": 7.4, "hasta": 11.7,
              "camara": [{"x": 0, "y": 0, "ancho": 680}, {"con_la_palabra": "parte", "x": 0, "y": 95, "ancho": 680, "mov": 1.0}]}]},
        {"voz": ["12:3"], "recurso": APR_GUARDADO, "texto_en_pantalla": "Enseñarle una tarea", "escala_maxima": 1.7,
         "segundos_extra": 1.8,
         "que_tiene_que_verse": "La persona dice que si y Claude contesta «Listo, la deje guardada».",
         "tramos": [
             {"desde": 1.2, "hasta": 11.4, "dura": 0.9, "camara": [{"x": 0, "y": 40, "ancho": 680}]},
             {"desde": 11.6, "hasta": 15.4, "camara": [{"x": 0, "y": 40, "ancho": 680}],
              "recuadros": [{"que_marca": "Listo, la deje guardada", "x": 1.5, "y": 57.2, "ancho": 97.0, "alto": 9.2,
                             "con_la_palabra": "igual"}]}]},
    ]})

# --- 8, 9, 10, 11: las de siempre con los parrafos corridos
def correr(esc, numero, parrafos, mapa):
    e = copy.deepcopy(esc)
    e["numero"] = numero
    e["parrafos"] = parrafos
    for tm in e["tomas"]:
        tm["voz"] = [mapa(v) for v in tm["voz"]]
    return e

def corrido(v):
    p, _, resto = v.partition(":")
    nuevo = {"11": 13, "12": 14, "13": 15, "14": 16, "15": 17, "16": 18}[p]
    return f"{nuevo}" + (f":{resto}" if resto else "")

escenas.append(correr(esc1[6], 8, [13], corrido))
escenas.append(correr(esc1[7], 9, [14], corrido))
e8 = correr(esc1[8], 10, [15, 16], corrido)
# la lamina dice lo que dice el parrafo 16
lam = e8["tomas"][1]["lamina"]
lam["renglones"] = [
    {"texto": "No elimina archivos", "con_la_frase": 1},
    {"texto": "No manda mails si no se lo pedís", "con_la_frase": 2},
    {"texto": "No muestra mails de Dirección ni RRHH", "con_la_frase": 3},
]
escenas.append(e8)
escenas.append(correr(esc1[9], 11, [17, 18], corrido))

out["escenas"] = escenas
destino = VID / "escenas_v2.json"
destino.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("escrito", destino, len(escenas), "escenas")
