# Diseño 3D con IA o por código: cómo lo hacen otros (tanda 11, 17/10/2026)

Investigación de solo lectura del 17/10/2026 (un agente `investigador` Sonnet; fuentes abiertas y API pública de GitHub
ese día; nada instalado ni clonado). Completa `Claude Fak\viernes-17-plan-sistema\20-informes\afuera_3d.md` (15/10),
que ya tenía build123d-mcp, text-to-cad, Fusion, Onshape, Zoo, el escáner Raptor y Carr Lane. Las fuentes que la ficha
usa se reabrieron a mano (Carr Lane, CCOHS, hoja de PLA Basic): coinciden.

## Qué recomiendo (decide Fak lo que es instalar o pagar)

| # | Qué | Por qué | Costo | Decide |
|---|---|---|---|---|
| 1 | **No instalar nada nuevo para diseñar.** Seguir con build123d + gates + `catia_medir.py` | Ningún MCP, skill ni paper resuelve apoyar un utillaje sobre tapizado; todos generan o controlan geometría (§a, §b) | 0 | hecho |
| 2 | Prender **build123d-mcp 0.3.90** en sesiones de 3D (tanda 2, punto 1) | Es el que puntea primero en CADGenBench con Opus 5.5; ya está instalado (0.3.83) | 0 | tanda 2 (ya decidido) |
| 3 | Leer, sin instalar, el README de **daiemon12/catia-v5-mcp-server** (125 ★, MIT, Windows) como referencia de llamadas COM | Trae trucos de campo (caché `gen_py`, `SystemService.Evaluate`) que coinciden con los nuestros; dice R2016+ y a la vez que anda en R20: R21 sin verificar | 0 | no hace falta instalarlo: `catia_medir.py` ya mide |
| 4 | Blender (`bpy` 5.2.2, GPL-3.0, Python 3.13, rueda de 338 MB) **solo para render**, no para decidir el asiento | Su manual dice que el soft body es «para movimiento secundario de animación» y no da precisión | 0, pero es instalar: **sí de Fak** | Fak |
| 5 | Almohadilla de **TPU 95A** sobre cuerpo rígido cuando un utillaje toca una superficie pintada o clase A (no el tapizado: ahí el blando ya es el vinilo) | Dos fuentes independientes (Siraya, UltiMaker/Ford) | filamento TPU | cuando haya una pieza así |
| 6 | Mirar la idea del «juez independiente» de **Pan-Chera/Multi-Agent-CAD** (1.038 ★, MIT) sin adoptarlo | La casa ya tiene la revisión ciega (G-E4); confirma el método | 0 | — |

**Ojo con §d.3 punto 1 del informe de abajo («tres almohadillas, no más»):** la tanda lo probó en la simulación del
virolador y **tres apoyos vuelcan** cuando la mano aprieta fuera de su triángulo (hasta 10 mm); la v16 quedó con cuatro
coplanares (4-2-1). Ver `docs/PLAN_3D_A_FONDO_2026-10-17.md`, «Resultados».

Lo que no se pudo ver: los posts de Alex Albert del 01 y 05/09 (no aparecieron en tres búsquedas; x.com no se abrió).
Lo descartado con motivo: FreeCAD, SolidWorks, Fusion de comunidad, OpenSCAD y las skills de impresión (otro motor o
duplican lo que ya hay; casi todas con menos de 300 estrellas); `anujasid/mcp-for-blender-pro` (posible imitación del
blender-mcp original: dueño a una letra, 346 estrellas en 2 días).

---

## Informe completo del 17/10

Fecha de consulta: 17/10/2026. Solo lectura: no se instalo nada ni se clono ningun repo.

Como leer las marcas:
- ABIERTA = abri la fuente yo (API publica de GitHub, README crudo, pagina HTML, PDF pasado a texto).
- BUSCADOR = solo vi el extracto del buscador; no abri la pagina.
- "Cita" = frase de la pagina, maximo 15 palabras. Las que dicen "(verificada)" las busque yo en el HTML o PDF. Las que dicen "(via extractor)" me las devolvio el lector de paginas y no las volvi a buscar en el HTML.
- Estrellas, ultimo push (fecha del ultimo commit subido), licencia: de `api.github.com` el 17/10/2026, ABIERTA. Donde dice "NOASSERTION" o "None", GitHub no detecto una licencia clara: sin licencia clara no se puede reutilizar el codigo.

## Lo principal en cuatro renglones

1. Ninguna herramienta ni paper de los que encontre resuelve el problema del virolador (asiento de una pieza rigida sobre una capa blanda). Todas generan o controlan geometria. Por eso en la columna "tapizado" casi todo es NO o PARCIAL.
2. La regla que explica el hamaqueo esta publicada hace decadas y la encontre en dos fuentes abiertas: sobre una referencia primaria van tres apoyos, no mas, porque los apoyos redundantes dejan la posicion indeterminada y pueden danar la pieza (Carrlane), y para piezas apoyadas que son flexibles se usan mas de tres (principio N-2-1, Universidad de Michigan, que cita a Cai y otros 1996).
3. Para el contacto con superficie terminada o pintada, lo que publican (dos fuentes independientes) es cuerpo rigido mas almohadillas de TPU 95A. Nadie publica una regla para apoyar sobre un tapizado blando de 0,5 a 1 mm.
4. Blender no sirve para decidir el asiento: su manual dice que el soft body se hizo para movimiento secundario de animacion, y no da ninguna precision.

---

## (a) Tablas de herramientas

Columna "Tapizado": SI = resuelve el asiento sobre superficie blanda; PARCIAL = ayuda a generar o controlar geometria pero no resuelve el asiento; NO = no toca el problema.
Windows: lo que dice el README (ABIERTA) o "sin verificar".

### a.0 Datos nuevos sobre lo que ya se sabia (actualizacion con fecha)

| Herramienta | URL | Estrellas | Ultimo push | Licencia | Windows | Tapizado | Veredicto |
|---|---|---|---|---|---|---|---|
| text-to-cad | https://github.com/earthtojake/text-to-cad | 21.106 (el 17/10/2026; el dato previo era ~20.874) | 17/10/2026 | MIT | el README pide apagar Smart App Control (dato que ya tenian) | NO: genera y chequea imprimibilidad, no asiento | USAR (como ya lo tienen) |
| build123d-mcp (pzfreo) | https://github.com/pzfreo/build123d-mcp | 113 | 15/10/2026 | Apache-2.0 | ya lo usan | PARCIAL: genera y verifica geometria | USAR |
| cadgenbench (Hugging Face) | https://github.com/huggingface/cadgenbench | 141 | 07/08/2026 | Apache-2.0 | sin verificar | NO: mide generar desde especificacion | solo referencia |
| cadgenbench-build123d (pzfreo) | https://github.com/pzfreo/cadgenbench-build123d | 6 | 29/09/2026 | Apache-2.0 | sin verificar | NO | referencia: es el pipeline reproducible Claude Code + build123d-mcp |
| blender-mcp (ahujasid), RENOMBRADO | https://github.com/ahujasid/mcp-for-blender (la URL vieja `ahujasid/blender-mcp` redirige) | 31.271 | 06/10/2026 | MIT | SI: el README trae instalador de PowerShell; pide Python 3.11 segun README | NO | DESCARTAR para asiento; sirve para render/vista |
| mcp-for-blender-pro (anujasid) | https://github.com/anujasid/mcp-for-blender-pro | 346 | 16/10/2026 | MIT | sin verificar | NO | DESCARTAR: posible imitacion. El dueno se llama casi igual a `ahujasid` (una letra de diferencia), el repo se creo el 15/10/2026 y ya tiene 346 estrellas en 2 dias. No abri su codigo |
| freecad-mcp (neka-nat) | https://github.com/neka-nat/freecad-mcp | 2.911 (API); los 879 y 940 de los extractos de buscador son viejos | 13/10/2026 | MIT | el README no lo dice (FreeCAD si corre en Windows): sin verificar | NO | ver a.2 |

### a.1 CATIA V5 (la unica pista que apunta a la herramienta que Barack usa de verdad)

| Herramienta | URL | Estrellas | Ultimo push | Licencia | Windows | Tapizado | Veredicto |
|---|---|---|---|---|---|---|---|
| catia-v5-mcp-server (daiemon12) | https://github.com/daiemon12/catia-v5-mcp-server | 125 | 17/10/2026 (el mismo dia) | MIT | SI, solo Windows (COM con pywin32), Python 3.10+ | NO: 98 herramientas para modelar, medir y exportar; no hay nada de asiento | PROBAR en modo lectura: solo como referencia de llamadas COM de medicion |

Lo que dice su README (ABIERTA, leido completo hasta la instalacion):
- Pide "CATIA V5 R2016+" en requisitos, pero en las notas de compatibilidad informa que en V5R20 (2010) el flujo basico anda de punta a punta. R21 (la de Barack) no figura en el README: sin verificar. Hay una contradiccion entre los dos renglones.
- Para R20 cuentan dos trucos que a ustedes les pueden ahorrar tiempo con COM: una cache vieja de `gen_py` de pywin32 hacia parecer que faltaba `AddNewPad` (se arreglo borrando la cache), y las medidas que devuelven arreglos van por un desvio con `SystemService.Evaluate`. Son datos de campo del propio README.
- Incluye medicion (distancia, inercia, caja contenedora, parametros) y exportacion STEP/STL. Tambien modela, por eso conviene no darle permisos de escritura sobre piezas reales.
- Se descarto AstroQuestStudio (0 estrellas, 3 commits): este es otro repo y tiene mas uso, pero 125 estrellas sigue siendo poca adopcion.

### a.2 FreeCAD

| Herramienta | URL | Estrellas | Ultimo push | Licencia | Windows | Tapizado | Veredicto |
|---|---|---|---|---|---|---|---|
| freecad-mcp (neka-nat) | https://github.com/neka-nat/freecad-mcp | 2.911 | 13/10/2026 | MIT | sin verificar (README de 2,8 KB) | NO | DESCARTAR: ya tienen build123d y CATIA; FreeCAD seria un tercer motor |
| freecad-ai (ghbalf) | https://github.com/ghbalf/freecad-ai | 574 | 16/10/2026 | LGPL-2.1 | SI: el README trae instalacion para Linux, macOS y Windows | NO | DESCARTAR (mismo motivo) |
| freecad-addon-robust-mcp-server (spkane) | https://github.com/spkane/freecad-addon-robust-mcp-server | 256 | 01/10/2026 | MIT | parcial: tiene modo sin interfaz; el modo embebido es solo Linux | NO | DESCARTAR |
| freecad_mcp (bonninr) | https://github.com/bonninr/freecad_mcp | 228 | 20/03/2025 | MIT | sin verificar | NO | DESCARTAR: sin commits hace 19 meses |
| freecad-mcp (contextform) | https://github.com/contextform/freecad-mcp | 136 | 15/08/2025 | sin licencia | sin verificar | NO | DESCARTAR: sin licencia |

### a.3 SolidWorks (Barack no lo usa: todos DESCARTAR salvo como referencia de ideas)

| Herramienta | URL | Estrellas | Ultimo push | Licencia | Windows | Tapizado | Veredicto |
|---|---|---|---|---|---|---|---|
| solidworks-automation-skill (wzyn20051216) | https://github.com/wzyn20051216/solidworks-automation-skill | 1.264 | 12/10/2026 | MIT | SI (instalador Windows) | NO | DESCARTAR: exige SolidWorks |
| mcp-server-solidworks (eyfel) | https://github.com/eyfel/mcp-server-solidworks | 396 | 07/10/2026 | AGPL-3.0 | SI, y pide SolidWorks 2026 | NO | DESCARTAR |
| SolidworksMCP-TS (vespo92) | https://github.com/vespo92/SolidworksMCP-TS | 240 | 20/09/2026 | MIT | Windows (COM); en el buscador figura "Alpha / Experimental" (BUSCADOR) | NO | DESCARTAR |
| Solidworks-MCP (alisamsam) | https://github.com/alisamsam/Solidworks-MCP | 166 | 23/03/2026 | MIT | Windows (BUSCADOR) | NO | DESCARTAR |
| Solidworks-MCP-Server (HarrierPigeon) | https://github.com/HarrierPigeon/Solidworks-MCP-Server | no lo lei (no entro en el listado de la API) | sin verificar | sin verificar | SI: README dice Windows, SolidWorks 2022+, COM por pywin32 (ABIERTA) | NO | DESCARTAR |
| CAD-Agent-Hub (Cai-aa) | https://github.com/Cai-aa/CAD-Agent-Hub | 98 | 07/09/2026 | MIT | sin verificar | NO | referencia: dice incluir puentes para CATIA, SolidWorks, NX y Fusion; no lo abri |
| claude-cad (0oKevino0) | https://github.com/0oKevino0/claude-cad | 5 | 05/10/2026 | MIT | README con comandos de Windows; SolidWorks es solo Windows | PARCIAL: "capa de verificacion" de piezas CadQuery | DESCARTAR por adopcion (5 estrellas); la idea (probar que la pieza es valida antes de entregar) ya la tienen en sus gates |

### a.4 Fusion (comunidad)

| Herramienta | URL | Estrellas | Ultimo push | Licencia | Windows | Tapizado | Veredicto |
|---|---|---|---|---|---|---|---|
| Fusion-360-MCP-Server (AuraFriday) | https://github.com/AuraFriday/Fusion-360-MCP-Server | 127 | 28/01/2026 | sin licencia clara | sin verificar | NO | DESCARTAR |
| fusion360-mcp-server (faust-machines) | https://github.com/faust-machines/fusion360-mcp-server | 122 | 06/10/2026 | MIT | SI: README con instalacion para macOS y Windows | NO | DESCARTAR: Barack no usa Fusion |
| fusion360-mcp-server (ArchimedesCrypto) | https://github.com/ArchimedesCrypto/fusion360-mcp-server | 83 | 19/06/2026 | MIT | sin verificar | NO | DESCARTAR |
| fusion360-claude-ultimate (Misterbra) | https://github.com/Misterbra/fusion360-claude-ultimate | 59 | 20/04/2026 | sin licencia | sin verificar | NO | DESCARTAR |
| Autodesk-Fusion-360-MCP-Server (JustusBraitinger) | https://github.com/JustusBraitinger/Autodesk-Fusion-360-MCP-Server | 56 | 01/07/2026 | MIT | sin verificar | NO | DESCARTAR |

### a.5 CadQuery y build123d (agentes y servidores)

| Herramienta | URL | Estrellas | Ultimo push | Licencia | Windows | Tapizado | Veredicto |
|---|---|---|---|---|---|---|---|
| Multi-Agent-CAD "MAC" (Pan-Chera) | https://github.com/Pan-Chera/Multi-Agent-CAD | 1.038 (creado 30/07/2026) | 17/10/2026 | MIT | sin verificar (Python 3.11+, sobre build123d) | PARCIAL: tiene verificacion visual y un "juez" independiente; el propio README dice que los ensambles no tienen tasa de exito medida | PROBAR como referencia de la idea del juez independiente; no adoptar |
| agentcad (jdilla1277) | https://github.com/jdilla1277/agentcad | 166 | 14/10/2026 | Apache-2.0 | no lo dice el README: sin verificar | PARCIAL: CLI y MCP para build123d o CadQuery, igual que lo que ya tienen | DESCARTAR: duplica build123d-mcp |
| cadquery-mcp-server (rishigundakaram) | https://github.com/rishigundakaram/cadquery-mcp-server | 20 | 29/06/2025 | sin licencia | sin verificar | NO | DESCARTAR |
| mcp-cadquery (bertvanbrakel) | https://github.com/bertvanbrakel/mcp-cadquery | 19 | 07/04/2025 | sin licencia | sin verificar | NO | DESCARTAR |
| cad-agent (Svetlana-DAO-LLC) | https://github.com/Svetlana-DAO-LLC/cad-agent | 51 | 17/02/2026 | sin licencia clara | sin verificar | NO | DESCARTAR |
| Varen-AI-CAD (vanyu0710) | https://github.com/vanyu0710/Varen-AI-CAD | 52 | 17/10/2026 | AGPL-3.0 | Windows x64 solo, beta cerrada (README) | PARCIAL: dice no entregar si fallan chequeos de geometria y colision | DESCARTAR: beta cerrada |

### a.6 OpenSCAD

| Herramienta | URL | Estrellas | Ultimo push | Licencia | Windows | Tapizado | Veredicto |
|---|---|---|---|---|---|---|---|
| OpenSCAD-MCP-Server (jhacksman) | https://github.com/jhacksman/OpenSCAD-MCP-Server | 208 | 07/09/2026 | MIT | SI: variable `OPENSCAD_EXECUTABLE` para Windows | NO | DESCARTAR: OpenSCAD no entrega STEP/BREP exacto como build123d (no verifique si algun MCP lo resuelve) |
| openscad-mcp (RobertCoop; el buscador lo mostro como quellant/openscad-mcp con el mismo README, probable cambio de nombre) | https://github.com/RobertCoop/openscad-mcp | 155 | 10/09/2026 | MIT | SI: README con rutas de Windows | NO | DESCARTAR |
| Kiln (codeofaxel) | https://github.com/codeofaxel/Kiln | 95 | 17/10/2026 | AGPL-3.0 | sin verificar | NO | DESCARTAR: es un MCP para controlar impresoras |

### a.7 Skills y mods de Claude Code para 3D e impresion (lo mas valorado, aparte de text-to-cad)

| Herramienta | URL | Estrellas | Ultimo push | Licencia | Windows | Tapizado | Veredicto |
|---|---|---|---|---|---|---|---|
| scenario-labs/skills | https://github.com/scenario-labs/skills | 1.036 | 17/10/2026 | MIT | sin verificar | NO: genera imagenes, video, audio y 3D artistico (mallas) | DESCARTAR para ingenieria |
| mcp-3D-printer-server (DMontgomery40) | https://github.com/DMontgomery40/mcp-3D-printer-server | 251 | 13/10/2026 | GPL-2.0 | sin verificar | NO | DESCARTAR: ya tienen laminado propio por comando |
| bambu-studio-ai (heyixuan2) | https://github.com/heyixuan2/bambu-studio-ai | 225 | 19/09/2026 | MIT | sin verificar | NO | DESCARTAR: ya tienen la skill `impresion-3d-bambu` |
| bambu-printer-mcp (DMontgomery40) | https://github.com/DMontgomery40/bambu-printer-mcp | 206 | 14/10/2026 | GPL-2.0 | sin verificar | NO | DESCARTAR |
| 3d-print-skill (EdwinjJ1) | https://github.com/EdwinjJ1/3d-print-skill | 27 | 10/03/2026 | sin licencia | sin verificar | NO | DESCARTAR |
| agentic-3d-modeling (evnchn-agentic) | https://github.com/evnchn-agentic/agentic-3d-modeling | 2 | 11/08/2026 | MIT | sin verificar | PARCIAL: skill de build123d con bucle de verificacion numerica | DESCARTAR por adopcion (2 estrellas) |

Resumen de la categoria: salvo text-to-cad (21.106) y los MCP de Blender, la adopcion es baja (menos de 300 estrellas casi todo). Ninguno trata contacto ni asiento.

---

## (b) Papers de generar CAD por codigo con modelos de lenguaje

Todos ABIERTA en el resumen (API de arXiv, 17/10/2026). No lei los PDF completos: los numeros de resultados que no estan en el resumen no los puedo dar.

| Paper | arXiv | Que mide | Resultado principal (segun el resumen) | Codigo y licencia | Sirve para tapizado |
|---|---|---|---|---|---|
| CAD-Recode (18/12/2024; ICCV 2025 segun el repo) | https://arxiv.org/abs/2412.14042 | reconstruir CAD en codigo Python desde nubes de puntos, en DeepCAD, Fusion360 y CC3D (escaneos reales) | "supera significativamente" a los metodos previos; sin numero en el resumen | https://github.com/filaPro/cad-recode, 269 estrellas, push 16/11/2025, licencia NOASSERTION (no detectada) | NO. Util si algun dia pasan un escaneo del panel a codigo, pero no es el problema de hoy |
| Text2CAD (NeurIPS 2024, 25/09/2024) | https://arxiv.org/abs/2409.17106 | texto a secuencia CAD parametrica; ~170 mil modelos y ~660 mil textos; calidad visual, precision parametrica, exactitud geometrica | primer marco texto a CAD parametrico para todos los niveles; sin numero en el resumen | https://github.com/SadilKhan/Text2CAD, 488 estrellas, push 15/05/2025, NOASSERTION | NO |
| CAD-Coder (texto a CadQuery) (26/05/2025) | https://arxiv.org/abs/2505.19713 | texto a scripts CadQuery con ajuste fino y refuerzo (GRPO) con recompensa de distancia Chamfer; 110 mil tripletes | "avanza el estado del arte"; sin numero en el resumen | el resumen no cita repo: sin verificar | NO |
| CAD-Coder (imagen a CadQuery, otro paper con el mismo nombre) (20/05/2025) | https://arxiv.org/abs/2505.14646 | VLM abierto que genera CadQuery desde imagen; 163 mil pares imagen-codigo | 100% de sintaxis valida y mejor similitud 3D que GPT-4.5 y Qwen2.5-VL-72B | https://github.com/anniedoris/CAD-Coder, 211 estrellas, Apache-2.0, push 17/07/2025 | NO |
| CADCodeVerify / CADPrompt (07/10/2024; ICLR 2025 segun el repo) | https://arxiv.org/abs/2410.05340 | verificar el objeto generado preguntando a un modelo de vision; benchmark de 200 pedidos | con GPT-4: -7,30% de distancia de nube de puntos y +5,0% de exito de compilacion contra el trabajo previo | https://github.com/Kamel773/CAD_Code_Generation, 66 estrellas, SIN licencia | NO, pero la idea de preguntas de validacion con imagen se parece a sus gates |
| Text2CAD-Bench (18/05/2026) | https://arxiv.org/abs/2605.18430 | 600 ejemplos en 4 niveles, de geometria basica a dominios reales | los modelos andan bien en geometria basica y empeoran mucho en topologia compleja y operaciones avanzadas | repo no citado en el resumen: sin verificar | NO. Confirma el limite: complejo = mal |
| ProCAD (03/02/2026) | https://arxiv.org/abs/2602.03045 | agente que pregunta cuando faltan cotas o hay datos en conflicto, para texto a CadQuery | los modelos ajustados inventan cotas cuando el texto es ambiguo; el agente las pide | sin verificar | PARCIAL en espiritu: igual que la regla de la casa "si falta un dato, TBD y preguntar" |
| CIT-CAD (07/09/2026) | https://arxiv.org/abs/2609.07434 | verificar la estructura de construccion y no solo la forma final (la IoU no ve esos errores) | critica que la IoU no detecta errores de decomposicion ni de operaciones booleanas | sin verificar | PARCIAL: mismo espiritu que CADGenBench en cuatro etapas |
| LLM-Aided DFM (03/09/2026) | https://arxiv.org/abs/2609.05559 | rediseno por manufacturabilidad en pasos verificados, de a una transicion | un solo disparo es poco confiable; por eso va en pasos verificados | sin verificar | PARCIAL: es "disenar para fabricar", no apoyar sobre blando |
| CADForge (03/10/2026), EvoCAD (13/10/2025), CAD-RL (13/08/2025) | https://arxiv.org/abs/2610.04262 , https://arxiv.org/abs/2510.11631 , https://arxiv.org/abs/2508.10118 | imagen a CadQuery con agentes; evolutivo con modelos de vision; refuerzo multimodal | sin numeros en los resumenes que lei | sin verificar | NO |

Conclusion de papers: ninguno mide ajuste, contacto ni asiento sobre superficie blanda. Miden si la pieza se parece a una de referencia (distancia de nube de puntos, Chamfer, IoU) o si el codigo compila. Lo util para ustedes son tres habitos de proceso: verificar con preguntas sobre la imagen (CADCodeVerify), pedir el dato que falta en vez de inventarlo (ProCAD) y no tratar la IoU como prueba de que esta bien armado (CIT-CAD).

---

## (c) Blender sin interfaz, por codigo

### c.1 Los posts de Alex Albert (01/09 y 05/09/2026)
No los encontre. Hice tres busquedas (dos normales y una extendida) con distintas combinaciones y no apareció ni el post ni una nota que lo cite. No abri x.com. Lo que SI encontre, que no es lo mismo y no lo atribuyo a nadie:
- BlenderMCP.org describe un camino "agente escribe bpy, corre Blender sin interfaz y mira el resultado, sin MCP" (BUSCADOR; lo cuenta a raiz de un articulo de otra empresa).
- Una nota japonesa sobre un experimento de modelado con Claude Opus 5.5 y Blender separa dos caminos: `blender -b --python build.py` desde Bash, sin Blender abierto, y el camino por MCP con una sesion abierta (BUSCADOR). URL: https://note.com/clearether/n/n30b928636df4
- El foro de desarrolladores de Blender dice que el `weak_sandbox.py` del MCP no es un limite de seguridad (BUSCADOR).

### c.2 blender-mcp
`ahujasid/blender-mcp` ahora es https://github.com/ahujasid/mcp-for-blender: 31.271 estrellas, MIT, ultimo push 06/10/2026 (ABIERTA, API). Instalador de PowerShell para Windows en el README (ABIERTA). Ejecuta codigo Python arbitrario dentro de Blender: no es una caja cerrada. Ojo con `anujasid/mcp-for-blender-pro` (ver a.0): parece imitacion.

### c.3 bpy como modulo de pip (ABIERTA, JSON de PyPI, 17/10/2026)
- Ultima version: 5.2.2, subida el 15/09/2026, licencia GPL-3.0, `requires_python ==3.13.*`.
- Rueda para Windows: `bpy-5.2.2-cp313-cp313-win_amd64.whl`, 338 MB. Tambien existe `win_arm64` (211 MB).
- La linea 4.5.x sigue saliendo (4.5.14 el 15/09/2026) pero con Python 3.11 fijo.
- La PC tiene Python 3.13.12 (lo vi en el PATH): la 5.2.2 de Windows le corresponde. No la instale.
- GPL-3.0: usarlo adentro de la empresa no obliga a nada; si algun dia se reparte un programa que lo incluya, si.

### c.4 Si Blender sirve para simular el asiento de una pieza rigida sobre una capa blanda
Respuesta: no para decidir. Evidencia del manual oficial de Blender 5.2 LTS (ABIERTA, paginas de soft body):
- Para que se hizo: simula objetos blandos deformables y se diseno "primarily for adding secondary motion to animation" (movimiento secundario de animacion, tipo rebote de un personaje).
- Para tela dice que el simulador de tela lo hace mejor.
- Las colisiones se calculan por defecto sobre los vertices del cuerpo blando (el manual lo dice como objetivo primario del calculo). El manual muestra que un plano blando atraviesa un cubo si no se activa la colision por cara, y que eso es mas lento.
- Con un vertice que entra en la zona entre "Outer" e "Inner" se aplica una fuerza de rechazo en la direccion de la normal. No lei los valores por defecto de esas zonas.
- Precision: la documentacion no da precision. No hay ninguna cifra de error ni de validacion contra mediciones.
- Rigid body (cuerpo rigido): solo vi el indice del manual, no lei sus paginas de colisiones: sin verificar.
- Para una capa de 0,5 a 1 mm la cuestion practica es de escala: el manual no dice con que resolucion de malla ni con que margen se puede confiar en ese orden. No se puede afirmar nada mas sin una prueba contra una medicion real.

Uso que si le veo a Blender: vista y render. Para el asiento, la decision es de geometria (cantidad y posicion de apoyos), y el rigor lo da una prueba fisica simple del utillaje impreso (apoyarlo y ver si hamaca). Idea de otra herramienta (elementos finitos de contacto con una capa elastica) que NO verifique: la dejo anotada, no la recomiendo todavia.

---

## (d) Empresas que publican como disenan utillajes, y sus criterios

Resultado general: todos publican los beneficios (plazo, costo, ergonomia) y casi nadie publica criterios de contacto. Lo que sirve para ustedes salio de fuentes de principios de fixturing (Carrlane, Michigan) y de dos o tres notas de materiales.

| Fuente | Marca | Que publica sobre criterios | Cita corta | Lo que NO publica |
|---|---|---|---|---|
| Carrlane (componentes de fixturing), guia de ubicacion y sujecion https://www.carrlane.com/engineering-resources/fixture-design-principles/locating-clamping-principles | ABIERTA, verificada en el HTML | 3-2-1: tres apoyos en la superficie primaria, dos en la secundaria, uno en la terciaria. Evitar ubicadores redundantes: pueden desubicar la pieza, bajar precision y danar la pieza o el utillaje por exceso de presion. Describe tambien apoyos regulables y apoyos compensadores ("equalizing", verificado en el HTML) que flotan: cuando un lado baja, el otro sube, para absorber las variaciones de la pieza. Los tres apoyos de la superficie primaria restringen cinco grados de libertad | "it's important to avoid using redundant locators" (verificada) | nada sobre superficies blandas |
| Universidad de Michigan (Camelio y Hu), fixtures de chapa https://research.me.mtu.edu/pubs/Camelio-%20Multiple%20Fault%20Diagnosis%20for%20Sheet%20Metal%20Fixtures.pdf | ABIERTA, PDF pasado a texto | 3-2-1 vale para cuerpo rigido. Para chapa flexible se usa N-2-1 (principio de Cai y otros, 1996, que cita el paper) | "more than 3 locators in the primary plane due to part flexibility" (verificada) | es la pieza apoyada la que es flexible. Aca el que apoya es el utillaje rigido sobre una pieza con piel blanda: es otro caso |
| Formlabs, blog de jigs y fixtures https://formlabs.com/blog/jigs-and-fixtures/ | ABIERTA, verificada en el HTML | poner referencias (datum) en el propio utillaje; un utillaje impreso en material mas blando puede reducir golpes en el ensamble | "might reduce jarring from the assembly process" (verificada) | no da esquema de ubicacion ni tolerancias. El white paper de 2017 (PDF) no lo pude abrir: el enlace devolvio una pagina HTML |
| Stratasys, guia tecnica "FDM For Jigs And Fixtures" (PDF de 9 MB) https://www.stratasys.co.jp/siteassets/3dlc/high-school/tag_fdm_jigsfixtures_en_1015_web.pdf | ABIERTA, PDF pasado a texto y buscado | integrar el utillaje en una sola pieza para no tener problemas de tolerancia de ensamble; agregar insertos roscados; ayudas de alineacion impresas en el propio utillaje | "Parts are easily capable of achieving +/- 0.13 mm (0.005 in)." (verificada; es para sus impresoras industriales, no la A2L) | busque goma, elastomero, blando, protege, pintado, terminado: nada sobre contacto con superficies sensibles |
| nTop con Stratasys, generador de utillajes FDM https://docs.ntop.com/help-articles/knowledge-base/fdm-fixture-generator/how-to-create-contoured-standoffs-for-jigs-and-fixtures | ABIERTA (pagina de soportes con contorno); los parametros (holgura de la pieza, detalle de cavidad, profundidad, margen) solo por BUSCADOR | los puntos de apoyo los define una lista de puntos que pone la persona; apoyos con contorno | "Importing a list of points rapidly defines where a part should be held." (via extractor) | sin valores de holgura; no explica por que esos puntos. La decision de donde apoyar la toma el diseñador |
| UltiMaker (casos Ford y VW) https://ultimaker.com/learn/3d-printing-jigs-and-fixtures-revolutionizing-manufacturing-efficiency/ | ABIERTA, verificada en el HTML | Ford (planta piloto de Colonia): jig que se cuelga atras del vehiculo, impreso en Tough PLA. Un utillaje de presion usa PA6-GF30 con TPU 95A. VW Autoeuropa: ahorro de unos 475.000 euros en dos años (dato de la propia UltiMaker) | "soft enough to prevent bodywork scratches" (verificada) | sin tolerancias ni numero de apoyos. Son cifras del fabricante de impresoras |
| Siraya Tech (fabricante de resinas), blog https://siraya.tech/blogs/news/3d-printed-jigs-and-fixtures | ABIERTA, verificada en el HTML | contra piezas terminadas o pintadas: cuerpo rigido (PETG o ABS) con almohadillas de TPU pegadas; resina logra ±0,05 mm contra FDM mas flojo | "TPU filament at Shore 95A provides a firm-but-soft contact surface" (verificada) | es un blog de un proveedor de materiales. El ±0,2 mm de FDM lo trajo el extractor y no lo busque en el HTML. Coincide en lo de TPU 95A con UltiMaker (otra empresa) |
| BMW Group, nota de prensa https://www.press.bmwgroup.com/global/article/detail/T0442351EN/bmw-group-expands-use-of-3d-printed-customised-robot-grippers | ABIERTA, verificada | herramientas de produccion impresas: pinzas de robot de ~120 kg hechas en 22 horas | "can be manufactured in just 22 hours" (verificada) | no es sobre apoyo en superficies blandas; no hay criterios |
| VW Autoeuropa (repost de la nota del caso) https://jpralves.net/post/2017/06/21/volkswagen-autoeuropa-maximizing-production-efficiency-with-3d-printed-tools-jigs-and-fixtures.html | ABIERTA (copia de terceros) | plazos de semanas a dias; diseño por funcion | "making function and performance the main drivers of design" (via extractor) | no dice nada de materiales ni de proteccion de la chapa pintada. La nota original de Assembly Magazine dio error 403 |
| Markforged | ABIERTA (la pagina del webinar) y BUSCADOR | la pagina que abri es solo un registro a un webinar; el buscador dice que su nylon reforzado sirve para utillajes que no marcan | sin cita util | no encontre guia de diseño de contacto; el articulo del blog dio 403 |
| Audi, Ford (mas alla de UltiMaker), BigRep | BUSCADOR | Audi Sport: sala de impresion para utillajes con software de trinckle y impresoras UltiMaker S; Ford: webinar de BigRep sobre utillajes; articulo de Javelin sobre un fixture de alineacion de vidrio de Mustang | sin cita (no abri las paginas; algunas dieron 403) | sin criterios de diseño |
| Fixturemate (trinckle), con Stratasys https://www.padtinc.com/digital-manufacturing/product/fixturemate/ | ABIERTA (pagina de PADT) y BUSCADOR (comunicado de Stratasys) | genera utillajes de ensamble, soldadura, medicion y bandejas en menos de 20 minutos con un asistente paso a paso | "wizard-style interface that requires no specialized training" (via extractor) | no publica como elige los puntos de contacto, ni cantidad, ni sobre-restriccion, ni contacto blando |
| Siemens NX | BUSCADOR | la busqueda no devolvio un caso de NX con jigs de Ford o Audi | sin cita | sin criterios |
| Prusa | BUSCADOR | no aparecio una guia de Prusa sobre utillajes | sin cita | sin criterios |
| Ultimaker, "Setup to Success" (PDF de 2019) | BUSCADOR | guia de puesta en marcha para fabricantes | sin cita | sin criterios que yo haya podido leer |

### d.1 Que criterios se pueden sostener con fuente y cuales son inferencia mia

Con fuente (ABIERTA):
1. Tres apoyos fijan el plano de referencia; mas apoyos para el mismo movimiento son redundantes y pueden mover o danar la pieza (Carrlane).
2. El esquema de tres apoyos es el de cuerpo rigido; para pieza flexible el paper cita el N-2-1, con mas de tres en el plano primario (Michigan). Ojo: es la pieza apoyada la flexible, no el utillaje.
3. Para tocar superficies terminadas o pintadas: cuerpo rigido y almohadillas de TPU 95A pegadas (Siraya; UltiMaker usa TPU 95A en un utillaje de presion).
4. Material mas blando en los ubicadores puede reducir golpes (Formlabs); PLA "tough" para no rayar la carroceria (UltiMaker/Ford).
5. Poner referencias (datum) en el propio utillaje (Formlabs).
6. En la herramienta de nTop, los puntos de apoyo los pone el diseñador a mano (nTop).

Dos causas distintas del hamaqueo (las dos vienen del encargo: "apoyos redundantes, asiento sobre blando"). No las mezclo ni invento el mecanismo exacto:
- Redundancia: con mas de tres apoyos para el mismo movimiento la posicion queda indeterminada y la pieza puede hamacar aun sobre una superficie dura (con fuente: Carrlane).
- Asiento blando: aun con tres apoyos, el utillaje puede inclinarse si la fuerza del operario cae fuera del triangulo que forman los apoyos, o si las almohadillas se comprimen distinto (la regla del triangulo esta en apuntes de curso, BUSCADOR, ver d.2).

Inferencia mia, NO publicada por nadie que yo haya abierto, a validar con una prueba fisica:
- Ubicar el utillaje contra elementos duros del sustrato (bordes, agujeros, nervios del plastico) y dejar la capa blanda solo para almohadillas, de modo que el asiento no dependa de cuanto se comprima el tapizado.
- La holgura que se le deja a los apoyos que sobran no tiene numero publicado: hay que medirla sobre el panel (espesor y compresion reales del tapizado). No la invento.

### d.2 Estabilidad: el triangulo de apoyo (BUSCADOR, apuntes de curso y guias de estudio, sin abrir)
- Los extractos de la busqueda sobre el esquema 3-2-1 dicen: 3-2-1 es el minimo para ubicar la pieza (equilibrio, no necesariamente estabilidad). Es estable si la fuerza resultante cae dentro del triangulo que forman los tres apoyos de la base; si cae afuera, genera un momento que vuelca o inclina la pieza. El esquema 4-2-1 cambia el triangulo por un rectangulo para ganar estabilidad.
- El buscador devolvio, entre otras, https://go-applied.com/wp-content/uploads/2014/12/Jig-and-Fixture-Design.pdf y guias de estudio; no se cual aporta cada frase y no las abri. Son apuntes, no una norma. Para ustedes el vinculo es: la fuerza del operario durante el virolado tiene que caer dentro del triangulo de los tres apoyos (analisis de fuerzas por etapa que pide el gate de proceso de la casa).

### d.3 Lo que sale como receta (marcando cada pieza: con fuente o inferencia)
1. Tres almohadillas, no mas, bien separadas, ubicadas de modo que la fuerza del virolado caiga dentro de su triangulo. Con fuente: Carrlane (tres apoyos, sin redundantes) y apuntes de curso (triangulo, BUSCADOR).
2. Si hace falta mas superficie de contacto: apoyos compensadores que flotan. Con fuente: Carrlane (verificado en el HTML); no encontre ningun caso publicado sobre tapizado.
3. Los puntos de apoyo que sobran pasan a ser holgura, no apoyo. Inferencia (la medida de la holgura hay que medirla en el panel).
4. Ubicacion lateral contra elementos duros del sustrato. Inferencia.
5. Almohadillas de TPU 95A sobre cuerpo rigido. Con fuente: Siraya y UltiMaker (dos empresas distintas).

---

## (e) Lo que no pude verificar

1. Los posts de Alex Albert del 01/09 y 05/09/2026: no aparecieron. No abri x.com. No reconstruyo lo que muestran.
2. Si el CATIA MCP de daiemon12 funciona en R21: el README solo confirma R20 y pide R2016+ (se contradicen). No lo instale ni lo ejecute.
3. Que licencia real tienen CAD-Recode, Text2CAD y Kamel773/CAD_Code_Generation (GitHub devolvio "no detectada" o ninguna); el repo del CAD-Coder de texto a CadQuery tampoco lo ubique.
4. Los resultados numericos de los papers: solo lei resumenes (los de CAD-Recode, Text2CAD, CAD-Coder y CIT-CAD no traen numeros en el resumen).
5. Estrellas y Windows de HarrierPigeon/Solidworks-MCP-Server (su README dice Windows, pero no obtuve las estrellas).
6. Windows en la mayoria de los MCP: solo lei README de una docena; el resto figura "sin verificar". El limite de la API sin cuenta es 60 consultas por hora; usé la de busqueda y pocas de repos.
7. Si algun MCP de OpenSCAD da salida STEP exacta.
8. White paper de Formlabs de 2017, guia de Markforged, nota de Assembly Magazine, articulo de Javelin sobre Ford: dieron error o devolvieron otra cosa; solo tengo extractos de buscador de algunos.
9. Los valores por defecto de las zonas "Outer/Inner" de la colision del soft body de Blender y el contenido de las paginas de colision del rigid body.
10. Si hay algun trabajo academico sobre apoyo de un sólido rígido sobre un recubrimiento blando delgado. No busque en revistas de ingenieria; los papers de arriba son de generacion de CAD.
11. Cantidad exacta de estrellas de otras familias (ej. repos de elementos finitos de contacto): fuera del alcance.

Archivos auxiliares de esta consulta (solo en la carpeta temporal de la sesion, no en el repo): scripts de consulta a la API de GitHub, arXiv, PyPI y paginas en `scratchpad\tools\`, y cuatro archivos descargados para leerlos en `scratchpad\pdfs\` (dos PDF de Stratasys, un PDF de la Universidad de Michigan y una pagina HTML de Formlabs que el enlace devolvio en lugar del PDF). Ademas el lector de paginas guardo un PDF de Stratasys en la carpeta de resultados de herramientas de la sesion. No se borro nada. No se escribio nada en Supabase, en Y:\, en el arb ni en OneDrive.
