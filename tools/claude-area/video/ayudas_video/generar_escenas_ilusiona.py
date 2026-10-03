#!/usr/bin/env python
# Arma escenas_ilusiona.json (el video "por sector") con las piezas de escenas.json (v1, intacto) y los recortes de tomas/.
import copy, json, pathlib

VID = pathlib.Path(r"C:\Dev\BarackMercosul\tools\claude-area\video")
v1 = json.loads((VID / "escenas.json").read_text(encoding="utf-8"))
esc1 = {e["numero"]: e for e in v1["escenas"]}
T = "tomas/"

# tamaños de los recortes (ancho, alto): los recuadros se dan en pixeles del recorte y aca se pasan a porcentaje
DIM = {
    "tres": (680, 470), "log": (900, 250), "com": (900, 330), "cal": (900, 176), "man": (900, 468),
    "rrh": (900, 500), "dir": (900, 880),
}


def R(k, x, y, w, h, que, **kw):
    cw, ch = DIM[k]
    d = {"que_marca": que, "x": round(100 * x / cw, 2), "y": round(100 * y / ch, 2),
         "ancho": round(100 * w / cw, 2), "alto": round(100 * h / ch, 2)}
    d.update(kw)
    return d


out = {}
out["_como_se_usa"] = list(v1["_como_se_usa"]) + [
    "VIDEO POR SECTOR (02/10/2026): un ejemplo real de cada sector, uno por uno, con grabaciones de la demostracion instalada como la PC de ESE sector (tomas/sector-*.mp4, que saca recortar_sectores_ilusiona.py de las grabaciones crudas) y de la prueba en Produccion (tomas/demo-02oct-*.mp4, recortar_demo_v2.py). Guion: guion_ilusiona.md.",
    "  tramos, camara, recuadros: ver escenas_v2.json (mismo armador).",
    "  pregunta (en la toma): {\"texto\": \"...\"}. Cartel con la pregunta arriba de la grabacion; sirve cuando la pregunta no se ve en la grabacion porque la mando otra sesion.",
    "  alto (en una vista de la camara): la vista es mas baja que la caja y se muestra entera, con el fondo de la grabacion arriba y abajo.",
]
out["video"] = dict(v1["video"])
out["video"]["salida"] = "../../../exports/CLAUDES_POR_AREA_20261001/Video por sector - Claude en Barack.mp4"
out["video"]["voz"] = "../../../exports/CLAUDES_POR_AREA_20261001/fuentes/voz_ilusiona"
out["video"]["placa_apertura"] = {"titulo": "Claude en Barack", "frase": "Un ejemplo real de cada sector", "segundos": 1.7}
out["ajustes"] = dict(v1["ajustes"])
out["ajustes"]["duracion_minima_s"] = 90
out["ajustes"]["duracion_maxima_s"] = 150

esc = []

# ---- 1. apertura (parrafo 1)
t_ticker = copy.deepcopy(esc1[1]["tomas"][0])
t_ticker["voz"] = ["1:1-2"]
esc.append({"numero": 1, "titulo": "Todo está escrito", "parrafos": [1], "tomas": [
    t_ticker,
    {"voz": ["1:3"], "recurso": "../manual/capturas/06-decir-el-puesto.png", "texto_en_pantalla": "",
     "encuadre": {"x": 0, "y": 7.5, "ancho": 100, "alto": 92.5}, "escala_maxima": 1.5,
     "que_tiene_que_verse": "Claude abierto con una pregunta de un puesto y su respuesta."}]})

# ---- 2. Produccion (parrafo 2): la prueba real de Facundo, la pregunta se ve en la conversacion
esc.append({"numero": 2, "titulo": "Producción", "parrafos": [2], "tomas": [
    {"voz": ["2"], "recurso": T + "demo-02oct-tres-piezas-responde.mp4", "texto_en_pantalla": "Producción",
     "segundos_extra": 2.0,
     "que_tiene_que_verse": "La pregunta de las tres piezas, Claude buscando, la respuesta (parar la línea, avisar al líder y a Calidad) y la fuente P-09.1.",
     "tramos": [
         {"desde": 20.0, "hasta": 34.8, "hasta_frase": 3, "mas": -0.1, "camara": [{"x": 0, "y": 0, "ancho": 680}]},
         {"desde": 34.8, "hasta": 48.2,
          "camara": [{"x": 0, "y": 0, "ancho": 680},
                     {"con_la_palabra": "Calidad", "x": 0, "y": 176, "ancho": 680, "mov": 0.8}],
          "recuadros": [R("tres", 14, 133, 654, 44, "parar la línea y avisar al líder y a Calidad", con_la_palabra="parar", mas=0.3),
                        R("tres", 40, 418, 460, 26, "la fuente: P-09.1 rev B.1", con_la_palabra="Calidad", mas=0.7,
                          etiqueta="P-09.1", etiqueta_lado="derecha")]}]}]})


# ---- 3 a 8: un sector por parrafo; la pregunta va en un cartel arriba (en la grabacion no se ve)
def sector(num, par, titulo, pregunta, clip, tramos, extra=2.0, dur_chip=None):
    return {"numero": num, "titulo": titulo, "parrafos": [par], "tomas": [
        {"voz": [str(par)], "recurso": T + clip, "texto_en_pantalla": titulo, "pregunta": {"texto": pregunta},
         "segundos_extra": extra, "que_tiene_que_verse": f"{titulo}: la respuesta de Claude y, marcado, el documento que cita.",
         "tramos": tramos}]}


V = 830     # ancho de la vista de un sector (la columna de texto mide ~810)

esc.append(sector(3, 3, "Calidad", "¿Cuánto tiempo hay para avisarle al proveedor que su material vino mal?", "sector-calidad-responde.mp4", [
    {"desde": 0.0, "hasta": 1.45, "hasta_frase": 3, "mas": -0.2, "camara": [{"x": 0, "y": 0, "ancho": V, "alto": 176}]},
    {"desde": 1.45, "hasta": 7.0, "camara": [{"x": 0, "y": 0, "ancho": V, "alto": 176}],
     "recuadros": [R("cal", 16, 60, 718, 30, "24 horas desde que se crea la NP", con_la_frase=3, mas=0.3),
                   R("cal", 16, 144, 660, 26, "la fuente: I-AC-010 rev A, §5.3", con_la_frase=4,
                     etiqueta="I-AC-010", etiqueta_lado="derecha")]}]))

esc.append(sector(4, 4, "Logística", "¿Cómo se estiba el producto terminado?", "sector-logistica-responde.mp4", [
    {"desde": 0.0, "hasta": 6.9, "hasta_frase": 3, "mas": -0.15, "camara": [{"x": 0, "y": 0, "ancho": V, "alto": 250}]},
    {"desde": 6.9, "hasta": 12.4, "camara": [{"x": 0, "y": 0, "ancho": V, "alto": 250}],
     "recuadros": [R("log", 52, 31, 450, 28, "racks: de 2 a 5 por fila", con_la_frase=3),
                   R("log", 52, 57, 392, 28, "cajas: hasta 4 por fila", con_la_frase=4),
                   R("log", 16, 127, 484, 28, "la fuente: I-LG-010 rev A, §5", con_la_palabra="cuatro",
                     etiqueta="I-LG-010", etiqueta_lado="derecha")]}]))

esc.append(sector(5, 5, "Compras", "El proveedor no confirmó la orden de compra. ¿Qué pasa?", "sector-compras-responde.mp4", [
    {"desde": 1.0, "hasta": 6.9, "hasta_frase": 4, "mas": -0.15, "camara": [{"x": 0, "y": 0, "ancho": V, "alto": 330}]},
    {"desde": 6.9, "hasta": 8.95, "camara": [{"x": 0, "y": 0, "ancho": V, "alto": 330}],
     "recuadros": [R("com", 16, 4, 745, 46, "el primer embarque vale como aceptación", con_la_frase=4),
                   R("com", 16, 144, 530, 28, "la fuente: I-CO-001 rev A, 5.1.1", con_la_palabra="aceptación",
                     etiqueta="I-CO-001", etiqueta_lado="derecha")]}]))

esc.append(sector(6, 6, "Mantenimiento", "¿Qué se mira en el mantenimiento autónomo?", "sector-mantenimiento-responde.mp4", [
    {"desde": 2.0, "hasta": 6.2, "hasta_frase": 3, "mas": -0.1, "camara": [{"x": 0, "y": 0, "ancho": V, "alto": 300}]},
    {"desde": 6.2, "hasta": 10.4,
     "camara": [{"x": 0, "y": 0, "ancho": V, "alto": 300},
                {"con_la_palabra": "toca", "x": 0, "y": 168, "ancho": V, "alto": 300, "mov": 0.9, "mas": 0.1}],
     "recuadros": [R("man", 52, 37, 762, 82, "vista", con_la_palabra="ve", mas=0.2),
                   R("man", 52, 126, 755, 40, "oído", con_la_palabra="oye"),
                   R("man", 52, 171, 770, 40, "olfato", con_la_palabra="huele"),
                   R("man", 52, 216, 760, 40, "tacto", con_la_palabra="toca"),
                   R("man", 16, 398, 525, 26, "la fuente: I-MT-001 rev C, 5.6", con_la_palabra="toca", mas=1.0,
                     etiqueta="I-MT-001", etiqueta_lado="derecha")]}]))

esc.append(sector(7, 7, "Recursos Humanos", "Me piden una capacitación. ¿Cómo sigue el trámite?", "sector-rrhh-responde.mp4", [
    {"desde": 0.0, "hasta": 6.4, "hasta_frase": 4, "mas": -0.1, "camara": [{"x": 0, "y": 0, "ancho": V, "alto": 300}]},
    {"desde": 6.4, "hasta": 13.0,
     "camara": [{"x": 0, "y": 0, "ancho": V, "alto": 300},
                {"con_la_palabra": "procedimiento", "x": 0, "y": 146, "ancho": V, "alto": 300, "mov": 0.9}],
     "recuadros": [R("rrh", 50, 32, 775, 272, "los pasos del trámite", con_la_palabra="Paso"),
                   R("rrh", 16, 377, 395, 28, "la fuente: P-18 rev F, §5.4 a §5.7", con_la_palabra="procedimiento",
                     etiqueta="P-18", etiqueta_lado="derecha")]}]))

esc.append(sector(8, 8, "Dirección", "¿Qué hay que llevar a la revisión por la Dirección?", "sector-direccion-espera.mp4", [
    {"desde": 4.0, "hasta": 7.0, "hasta_frase": 2, "mas": 0.1, "camara": [{"x": 0, "y": 0, "ancho": V, "alto": 300}]},
    {"recurso": T + "sector-direccion-responde.mp4", "desde": 0.0, "hasta": 6.0,
     "camara": [{"x": 0, "y": 26, "ancho": V, "alto": 300},
                {"con_la_palabra": "manual", "x": 0, "y": 300, "ancho": V, "alto": 300, "mov": 1.0, "mas": -0.8}],
     "recuadros": [R("dir", 16, 396, 553, 26, "el manual: MC-09 rev F, 9.3.2", con_la_palabra="manual", etiqueta="MC-09",
                     etiqueta_lado="derecha")]}]))

# ---- 9. Ingenieria (parrafo 9): el arb y lo que arma
esc.append({"numero": 9, "titulo": "Ingeniería", "parrafos": [9], "tomas": [
    {"voz": ["9:1"], "recurso": T + "arb-06ago2026-ventana-con-una-bom.png", "texto_en_pantalla": "Ingeniería · el arb",
     "escala_maxima": 1.2, "que_tiene_que_verse": "La ventana Maestro de Relaciones - BA con una BOM a la vista."},
    {"voz": ["9:2"], "recurso": T + "arb-06ago2026-trae-la-bom-de-cada-pieza.mp4", "texto_en_pantalla": "Ingeniería · el arb",
     "desde": 0.0, "hasta": 6.0, "velocidad": "ajustar", "escala_maxima": 1.2,
     "que_tiene_que_verse": "El arb: se escribe la pieza, se llena la grilla con su BOM y se escribe el consumo."},
    {"voz": ["9:3"], "recurso": "triptico", "texto_en_pantalla": "", "segundos_extra": 1.0,
     "que_tiene_que_verse": "Tres entregables reales de Ingeniería: la hoja de operaciones, la lámina de proceso y el flujograma.",
     "triptico": {"tarjetas": [
         {"recurso": T + "ho-992-hot-melt-hoja-2.png", "encuadre": {"x": 0, "y": 8, "ancho": 100, "alto": 78},
          "titulo": "Hoja de operaciones", "con_la_palabra": "hojas"},
         {"recurso": T + "lamina-proceso-insert.png", "encuadre": {"x": 0, "y": 0, "ancho": 100, "alto": 86},
          "titulo": "Lámina de proceso", "con_la_palabra": "láminas"},
         {"recurso": T + "flujograma-160.png", "encuadre": {"x": 15, "y": 8, "ancho": 70, "alto": 40},
          "titulo": "Flujograma", "con_la_palabra": "flujogramas"}]}}]})

# ---- 10. para todos: el mail (parrafo 10)
MAIL_PEDIDO, MAIL_ABRE = T + "demo-02oct-mail-pedido.mp4", T + "demo-02oct-mail-se-abre.mp4"
MAIL_MANDALO, MAIL_LISTO = T + "demo-02oct-mail-mandalo.mp4", T + "demo-02oct-mail-listo.mp4"
esc.append({"numero": 10, "titulo": "Para todos: el mail", "parrafos": [10], "tomas": [
    {"voz": ["10:1-2"], "recurso": MAIL_PEDIDO, "texto_en_pantalla": "Para todos",
     "que_tiene_que_verse": "El pedido del mail, Claude armándolo y Outlook que se abre con el mail armado.",
     "tramos": [
         {"desde": 0.2, "hasta": 2.2, "hasta_frase": 2, "camara": [{"x": 0, "y": 0, "ancho": 680}]},
         {"desde": 36.0, "hasta": 38.8, "hasta_palabra": "Outlook", "mas": -0.05, "etiqueta": "Espera acortada",
          "camara": [{"x": 0, "y": 0, "ancho": 680}]},
         {"recurso": MAIL_ABRE, "desde": 0.5, "hasta": 2.5, "camara": [{"x": 0, "y": 0, "ancho": 1148}]}]},
    {"voz": ["10:3"], "recurso": MAIL_ABRE, "texto_en_pantalla": "Para todos", "segundos_extra": 2.3,
     "que_tiene_que_verse": "El mail con el botón Enviar, «mandalo» escrito en Claude y «Listo: salió a…».",
     "tramos": [
         {"desde": 2.5, "hasta": 4.5, "dura": 0.8, "camara": [{"x": 0, "y": 130, "ancho": 800}],
          "recuadros": [{"que_marca": "el botón Enviar", "x": 2.6, "y": 26.0, "ancho": 6.2, "alto": 14.5}]},
         {"recurso": MAIL_MANDALO, "desde": 0.15, "hasta": 2.0, "dura": 0.9, "camara": [{"x": 0, "y": 308, "ancho": 680}]},
         {"recurso": MAIL_LISTO, "desde": 0.9, "hasta": 4.3, "fundido": 0, "camara": [{"x": 0, "y": 298, "ancho": 676}],
          "recuadros": [{"que_marca": "Listo: salio a Facundo Santoro", "x": 2.0, "y": 86.5, "ancho": 96.0, "alto": 8.5}]}]}]})

# ---- 11. presentacion (parrafo 11)
PRES_PEDIDO, PRES_PPT = T + "demo-02oct-presentacion-pedido.mp4", T + "demo-02oct-presentacion-powerpoint.mp4"
esc.append({"numero": 11, "titulo": "Para todos: la presentación", "parrafos": [11], "tomas": [
    {"voz": ["11"], "recurso": PRES_PEDIDO, "texto_en_pantalla": "Para todos", "segundos_extra": 1.8,
     "que_tiene_que_verse": "El pedido de la presentación, Claude armándola y PowerPoint abierto con las diapositivas.",
     "tramos": [
         {"desde": 0.3, "hasta": 2.4, "dura": 0.9, "camara": [{"x": 0, "y": 0, "ancho": 680}]},
         {"desde": 3.9, "hasta": 5.9, "dura": 0.8, "etiqueta": "Espera acortada",
          "camara": [{"x": 0, "y": 0, "ancho": 680}]},
         {"recurso": PRES_PPT, "desde": 2.1, "hasta": 4.9,
          "camara": [{"x": 0, "y": 0, "ancho": 1767},
                     {"t": 1.3, "x": 240, "y": 50, "ancho": 1560, "mov": 0.9}],
          "recuadros": [{"que_marca": "la fuente al pie de la hoja", "x": 26.5, "y": 89.0, "ancho": 41.0, "alto": 5.5,
                         "foco": False}]}]}]})

# ---- 12. ensenarle una tarea (parrafo 12)
APR_PROPONE, APR_GUARDADO = T + "demo-02oct-aprende-propone.mp4", T + "demo-02oct-aprende-guardado.mp4"
esc.append({"numero": 12, "titulo": "Para todos: enseñarle", "parrafos": [12], "tomas": [
    {"voz": ["12"], "recurso": APR_PROPONE, "texto_en_pantalla": "Para todos", "segundos_extra": 1.8,
     "que_tiene_que_verse": "Se le enseña el parte de fin de turno, Claude muestra cómo quedaría («¿La guardo así?») y «Listo, la dejé guardada».",
     "tramos": [
         {"desde": 0.2, "hasta": 1.5, "dura": 0.7, "camara": [{"x": 0, "y": 0, "ancho": 680}]},
         {"desde": 7.4, "hasta": 11.7, "dura": 1.1,
          "camara": [{"x": 0, "y": 0, "ancho": 680}, {"t": 0.5, "x": 0, "y": 95, "ancho": 680, "mov": 0.6}]},
         {"recurso": APR_GUARDADO, "desde": 1.2, "hasta": 11.4, "dura": 0.6, "etiqueta": "Espera acortada", "camara": [{"x": 0, "y": 40, "ancho": 680}]},
         {"recurso": APR_GUARDADO, "desde": 11.6, "hasta": 15.4, "camara": [{"x": 0, "y": 40, "ancho": 680}],
          "recuadros": [{"que_marca": "Listo, la dejé guardada", "x": 1.5, "y": 57.2, "ancho": 97.0, "alto": 9.2}]}]}]})

# ---- 13. controlado (parrafo 13)
# 03/10/2026: la ultima toma era el cartel de permiso (capturas/14-claude-pide-permiso.png). Con «Omitir permisos» en
# todas las PC ese cartel ya no aparece. Va la conversacion real del mail (la misma grabacion de la escena 10): Claude
# avisa «lo mandás vos con el botón, o decime "mandalo" y lo mando yo», la persona escribe «mandalo» y recien ahi dice
# «Listo: salió a…». La voz y los tiempos no cambian: la toma dura lo que dura la frase.
pedido = {"voz": ["13:5"], "recurso": MAIL_LISTO, "texto_en_pantalla": "Está controlado",
          "que_tiene_que_verse": "La conversación real del mail: Claude avisa que lo manda la persona con el botón o si le dice «mandalo», la persona escribe «mandalo» y recién ahí «Listo: salió a…».",
          "tramos": [{"desde": 1.9, "hasta": 4.3, "camara": [{"x": 0, "y": 298, "ancho": 676}],
                      "recuadros": [{"que_marca": "«mandalo», lo que escribió la persona", "x": 86.0, "y": 71.0,
                                     "ancho": 11.5, "alto": 6.3, "con_la_palabra": "porque", "foco": False}]}]}
esc.append({"numero": 13, "titulo": "Está controlado", "parrafos": [13], "tomas": [
    {"voz": ["13:1-2"], "recurso": T + "sector-calidad-responde.mp4", "texto_en_pantalla": "Está controlado",
     "que_tiene_que_verse": "Una respuesta con su fuente marcada: Claude dice de dónde sacó el dato.",
     "tramos": [{"desde": 5.0, "hasta": 9.0, "camara": [{"x": 0, "y": 0, "ancho": V, "alto": 176}],
                 "recuadros": [R("cal", 16, 144, 660, 26, "la fuente: I-AC-010 rev A", con_la_palabra="dónde",
                                 etiqueta="Fuente: I-AC-010", etiqueta_lado="derecha")]}]},
    {"voz": ["13:3-4"], "recurso": "lamina", "texto_en_pantalla": "",
     "que_tiene_que_verse": "Lámina de texto: no borra nada si no se lo pedís, no muestra lo reservado.",
     # 03/10/2026: decia «No elimina nada». El tutorial dice que borra si la persona se lo pide («borrala»), que es lo
     # que deja pasar el control pc-guard: la voz y la lamina dicen ahora lo mismo que el tutorial.
     "lamina": {"titulo": "Claude no hace esto solo", "icono": "x", "renglones": [
         {"texto": "No borra nada si no se lo pedís", "con_la_frase": 1}, {"texto": "No muestra lo reservado", "con_la_frase": 2}]}},
    pedido]})

# ---- 14. cierre (parrafo 14)
tri = copy.deepcopy(esc1[9]["tomas"][0])
tri["voz"] = ["14"]
esc.append({"numero": 14, "titulo": "Cierre", "parrafos": [14], "tomas": [tri]})

out["escenas"] = esc
destino = VID / "escenas_ilusiona.json"
destino.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("escrito", destino, len(esc), "escenas")
