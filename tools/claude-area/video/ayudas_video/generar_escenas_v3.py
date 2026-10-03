#!/usr/bin/env python
# Arma escenas_v3.json a partir de escenas_v2.json (v2 intacto): cambia solo la escena "Lo que no hace solo".
# Motivo (03/10/2026, decision de Facundo): todas las PC quedan en «Omitir permisos», asi que el cartel de permiso
# ya no aparece. La persona decide con sus palabras («borralo», «mandalo») y lo que frena son los controles del asistente.
import copy, json, pathlib

VID = pathlib.Path(__file__).resolve().parents[1]
v2 = json.loads((VID / "escenas_v2.json").read_text(encoding="utf-8"))

out = copy.deepcopy(v2)
out["_como_se_usa"] = list(v2["_como_se_usa"]) + [
    "VERSION 3 (03/10/2026): igual que la version 2, menos la escena 10 «Lo que no hace solo». Ya no muestra el cartel de permiso (todas las PC quedan en «Omitir permisos»): la voz (parrafos 15 y 16 de voz_v3) dice lo que frenan los controles del asistente y la escena es una sola lamina, renglon por renglon con la voz. Sale de ayudas_video/generar_escenas_v3.py.",
]
out["video"]["salida"] = "../../../exports/CLAUDES_POR_AREA_20261001/Video tutorial - Claude en Barack (version 3).mp4"
out["video"]["voz"] = "../../../exports/CLAUDES_POR_AREA_20261001/fuentes/voz_v3"

# Lo que dice cada renglon lo sostiene un control del asistente (plugin barack-area 0.3.0):
#   pc-guard        en la PC no borra, no mueve ni renombra si la persona no lo pidio en su mensaje
#   mail-guard      un mail sale con el boton de la persona o cuando ella escribe que lo mande
#   servidor-guard  en el servidor frena siempre lo que cambia algo (ahi el cambio lo hace la persona a mano): solo lee
#   reglas de la casa, seccion 5: los mails de Direccion y de RRHH no se muestran
escena = {
    "numero": 10,
    "titulo": "Lo que no hace solo",
    "parrafos": [15, 16],
    "tomas": [{
        "voz": ["15", "16"],
        "recurso": "lamina",
        "texto_en_pantalla": "",
        "que_tiene_que_verse": "Lamina de texto: lo que Claude no hace solo, un renglon por cada cosa que dice la voz.",
        "lamina": {
            "titulo": "Claude no hace esto solo",
            "icono": "x",
            "renglones": [
                {"texto": "No borra archivos si no se lo pedís", "con_la_palabra": "borra"},
                {"texto": "No manda mails si no se lo pedís", "con_la_palabra": "manda"},
                {"texto": "No cambia nada en el servidor", "con_la_frase": 3},
                {"texto": "No muestra mails de Dirección ni RRHH", "con_la_frase": 4},
            ],
        },
    }],
}
numeros = [e["numero"] for e in out["escenas"]]
assert numeros.count(10) == 1 and out["escenas"][numeros.index(10)]["titulo"] == "Lo que no hace solo"
out["escenas"][numeros.index(10)] = escena

destino = VID / "escenas_v3.json"
destino.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("escrito", destino, len(out["escenas"]), "escenas")
