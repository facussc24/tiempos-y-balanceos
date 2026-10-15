---
name: impresion-3d-bambu
description: Preparar una pieza para la impresora 3D Bambu Lab A2L de Fak sin pasar por la ventana del laminador — laminar un .3mf por comando con Bambu Studio (perfiles completos de la máquina, el proceso y el filamento), asignar un color a cada parte y dejar el archivo listo para imprimir, con controles que frenan si el código salió mal. Usar cuando Fak pida "generá el código de impresión", "dejámelo listo para imprimir", "laminalo", "en dos colores", "mandalo a la Bambu", o al entregar una pieza 3D que va a esa impresora.
---

# impresion-3d-bambu — dejar una pieza lista para la Bambu Lab A2L

**Estado (13/10/2026): PROBADA con tres impresiones reales** en la A2L: virolador v14 (negro con
grabado amarillo, 1 h 43 min contra 1 h 41 estimado), tres fichas de tres colores (32,6 min contra
32) y el molde de probeta 50 x 50 (mandado 13:46, 10 h 49 min). Lo que sigue sin verse: el detector
ante una falla real.

## 1. Qué hay y qué no

| | Estado |
|---|---|
| Laminar por comando con Bambu Studio (el oficial, "por atrás") | **Probado** (v2.8.2.61, virolador v14) |
| Dos colores, un filamento por parte | **Probado en el código** (amarillo 0,05 g en 3 capas, negro 52,5 g) |
| Que la impresora lo imprima bien | **Probado el 13/10/2026** (virolador v14 y tres fichas: salieron bien) |
| Mandar a imprimir desde acá (sin que Fak toque nada) | **Probado el 13/10/2026 10:04** (virolador v14: arrancó, cargó el negro). Ver §1 bis |

La impresora: Bambu Lab A2L, boquilla 0,4, cama 330 × 320 × 325, cargador de 4 filamentos
(memoria `reference_impresora_3d_fak`). Qué filamento hay en cada lugar **se le pregunta a Fak o se
mira en una foto**: cambia.

## 1 bis. Mandar a imprimir por la red (desde el 13/10/2026: ANDA)

Fak activó «Modo solo LAN» + «Modo desarrollador» en la pantalla de la impresora (decisión suya).
Todo con `scripts/bambu_red.py`, que no usa librerías de terceros (MQTT a mano sobre TLS, FTPS):

```bash
python .claude/skills/impresion-3d-bambu/scripts/bambu_red.py --estado          # solo lee
python .claude/skills/impresion-3d-bambu/scripts/bambu_red.py --imprimir <archivo.gcode.3mf> --mapa 0,1          # muestra el plan
python .claude/skills/impresion-3d-bambu/scripts/bambu_red.py --imprimir <archivo.gcode.3mf> --mapa 0,1 --apply  # sube y manda
```

- **Sin `--mapa` elige solo el lugar del cargador** para cada filamento del archivo: mismo
  material (el perfil `GFAxx` del archivo contra el que informa la impresora) y el color más
  parecido. **Frena** si el material cargado no es el del laminado (probado con el gemelo: el
  archivo de PLA Basic contra el cargador con PLA Lite no se manda), si el color no se parece o
  si la impresora está ocupada. `--mapa 0,1` lo fuerza a mano (lugares contando desde 0).
  Tampoco manda un archivo con más de una placa (solo iría la 1).
- **Antes de mandar, la PRIMERA CAPA se le muestra a Fak** (15/10/2026: *"guardaste una foto del
  antes de imprimir?... agregarlo a la skill"*). `--imprimir` (con o sin `--apply`) deja
  `<archivo>_PRIMERA_CAPA.png` al lado del archivo (`primera_capa.py`): lo que pega en la cama vista
  de arriba, la pieza en negro y el borde de adherencia en naranja, con los mm² de apoyo. La
  miniatura del laminado NO sirve para esto: mostraba enteros tres pines que apoyaban en dos islitas
  de ~3,6 mm cada uno y se despegaron al 27 %. El dibujo usa Pillow (si falta, avisa y el envío sigue).
  Avisa cuando no hay borde y el apoyo total es chico (menos de 1000 mm²); con una pieza
  angosta, redonda o acostada, se relamina con `--ajuste brim_type=outer_only --ajuste brim_width=6`
  (y, si la forma lo permite, una cara de apoyo más ancha).
- **Vigilar hasta que termine** (solo lee; se lanza en segundo plano y su salida me despierta).
  **Se lanza en el MISMO mensaje en que se manda**, con `--despertar 5 --cada 30`: el 15/10/2026 se
  mandó sin vigilancia y la falla la vio Fak (*"el software no te despertó nunca?"*). `--apply` lo
  recuerda en el renglón que sigue a «ORDEN DE IMPRIMIR MANDADA».
  `--seguir <carpeta> [--fotos-en 41,44]`. Deja `seguimiento.log` y fotos de la cámara (capa 1,
  las capas pedidas, una cada 15 min y la final). Sale con 0 = terminó, 1 = falló o se canceló,
  2 = en pausa o con alarma, 3 = 15 minutos sin avanzar. **Después de mandar una impresión se
  lanza siempre**, con las capas donde cambia de color (salen de `quien_imprime_que.py`).
- `--foto <archivo.jpg>`: una foto de la cámara (puerto 6000). `--pausar`, `--reanudar`,
  `--cancelar` (los tres probados el 13/10/2026; `--imprimir` frena si la impresora está ocupada, con rollos elegidos a mano o solos).
- **Durante la impresión** (probado el 13/10/2026 sobre una pieza real, Fak lo vio en la pantalla):
  `--velocidad` muestra el modo y `--velocidad 1|2|3|4` lo cambia (1 silencioso, 2 estándar,
  3 deportivo = 124 % en la pantalla, 4 el más rápido); `--luz on|off`. Cada orden se confirma
  releyendo el estado. **La velocidad no se sube mientras se imprime una zona de medida crítica**
  (ese día se volvió a estándar para los anillos). Temperaturas y ventilador no se tocan a mano.
- **Saltear una pieza que salió mal y seguir con las demás:** `--saltear <archivo.gcode.3mf>` lista
  los objetos con su número; `--saltear <archivo> 12 --apply` lo manda. No se deshace. Solo sirve
  si la placa tiene **dos o más objetos**: el laminado ya los deja identificados (`exclude_object`;
  con un solo objeto Bambu Studio no los marca). Frena si el número no existe o si se piden todos
  (eso es cancelar). **La torre de purga no es un objeto: no se puede saltear.** **Probado de punta
  a punta el 13/10/2026** (placa de tres fichas en tres colores: se salteó la blanca en la capa 2,
  la impresora la informó como salteada —`s_obj`— y Fak la vio quedar más baja; las otras dos
  terminaron). Un objeto por color se asigna al laminar con `--parte-filamento "obj:<nombre>=N"`.
- **Pausar y reanudar: probados** en esa misma prueba (PAUSE a los 3 s, RUNNING al reanudar).
- `--avisar-retiro` (en segundo plano): sale cuando la placa baja de 35 °C con la impresión
  terminada; tarda unos 15 min desde 55 °C. Probado dos veces.
- **La prueba general del 13/10** (32 min, 10 g, 12 cambios de color): elección de rollos, envío,
  registro, pausa, salteo y avisos, todo bien; tiempo real 32,6 min contra 32 estimados.
- Etapas que parecen un cuelgue y no lo son (arranque oficial de la A2L, ~10 min antes de la
  primera capa): 8 calibra flujo, 3 mide vibraciones, **58 «preacondicionamiento térmico de la
  primera capa»** (espera a que la placa se estabilice), 1 nivela. Un cuelgue de verdad es
  `mc_print_line_number` clavado en 0.
- Datos de la impresora en `%USERPROFILE%\.claude\bambu-a2l.json` (IP, número de serie, código de
  acceso) y, **para que la PC de un compañero se conecte sola**, una copia en la nube de
  Ingeniería, al lado del registro:
  `INGENIERIA BARACK (NUNCA BORRAR)\1- GENERAL\5. 3D\IMPRESORA BAMBU A2L\bambu-a2l.json` (OK de Fak
  13/10/2026). **La skill se le pasa al equipo por mail, en un zip** (decisión de Fak, mismo día).
  El script busca primero la de la PC y después la de la nube (`cargar_datos()`); probado
  simulando una PC sin archivo propio. Si no encuentra ninguna, dice qué hacer. Requisitos del
  compañero: Bambu Studio instalado, la carpeta de Ingeniería sincronizada y el mismo wifi que la
  impresora. **El código de acceso no va al repo (es público), ni a esta skill, ni a la memoria.**
  Lo escribe Fak: `--pedir-codigo` le abre una ventanita. Si la IP cambia (la da el router), se
  corrige ahí. El número de serie sale del certificado de la impresora (`--preparar <ip>`).
- **Mandar a imprimir es una acción física: se manda cuando Fak lo pide y está cerca de la
  impresora** (placa vacía y limpia). Cancelar: orden `stop` por MQTT (probada) o el cuadrado
  rojo de la pantalla.

**La trampa de la A2L (costó un trabajo trabado 10 minutos):** su cargador de 4 lugares es la
**unidad física 16**. La orden `project_file` tiene que llevar
`"ams_mapping2": [{"ams_id": 16, "slot_id": N}, ...]` además del `ams_mapping` plano. Sin eso la
impresora contesta «success», pasa a PREPARE y se queda para siempre en la **etapa 77
(«Preparando AMS»)**, sin error y sin arrancar el código (renglón 0); el play de la pantalla no
hace nada. La forma completa de la orden salió del programa abierto Bambuddy
(`maziggy/bambuddy`, `backend/app/services/bambu_mqtt.py`), que ya soporta la A2L. Las etapas
(`stg_cur`) están en `get_stage_string()` del código de Bambu Studio (`DeviceManager.cpp`).

**Cómo se ve que arrancó bien:** `gcode_state` RUNNING, etapas 2 (calienta placa) → 13 (home) →
4 (carga filamento), `mc_print_line_number` > 0 y `ams.tray_now` = el lugar del primer filamento.

## 1 quater. El registro compartido (varias PC, una sola cuenta)

Fak, 13/10/2026: *"normalmente imprimimos desde distintas PCs… ¿usar la nube para sincronizarnos?"*.
`scripts/registro.py` guarda en la nube de Ingeniería,
`1- GENERAL\5. 3D\IMPRESORA BAMBU A2L\registro\<NOMBRE-DE-LA-PC>.jsonl`: **un archivo por PC** (cada
PC solo agrega renglones al suyo, así OneDrive no genera copias en conflicto) y el resumen junta
los de todas.

- `--imprimir … --apply` anota solo la impresión enviada (pieza, minutos estimados, gramos por
  filamento y **el número de chip de cada rollo**); `--seguir` anota el final (terminada o fallida,
  minutos reales, avance).
- `python .claude/skills/impresion-3d-bambu/scripts/registro.py --resumen`: horas de impresión,
  gramos gastados y lo que queda de cada rollo (la impresora no lo informa; se descuenta por chip,
  aunque cambien el rollo de lugar) y **qué mantenimiento toca** según la wiki de Bambu (eje Y cada
  200 h, cuchilla cada 3 rollos, extrusor cada 5, tubos cada 6, eje X y ventiladores cada mes).
  Un mantenimiento hecho se anota con `--anotar '{"tipo":"mantenimiento","que":"<el texto del resumen>"}'`.
- **Antes de mandar una pieza se mira el resumen**: si a un rollo no le alcanzan los gramos, se avisa.
- **Límite:** solo cuenta lo que se manda con la skill. Lo impreso directo desde Bambu Studio o
  desde la pantalla no queda anotado.

## 1 quinquies. La temperatura del lugar (idea de Fak, 13/10/2026)

La impresora no está en un lugar climatizado y de noche se apaga todo. Bambu pide **15 a 30 °C y
humedad por debajo de 85 %** (wiki de la A2L). `bambu_red.py --ambiente [minutos de la impresión]`
lo mide con dos fuentes y dice cuál es cada una:

- **La impresora en frío**: si está libre, con la placa apagada y la boquilla y la placa a menos de
  2 °C una de otra, esas lecturas son la temperatura del lugar (13/10 a la mañana: 16,5 y 17 °C).
  Con la impresora caliente no se puede medir y lo dice.
- **El pronóstico de afuera** para las horas que dura la impresión (open-meteo, Hurlingham, sin
  clave). Fak: adentro y afuera varían poco.

`--imprimir` lo muestra solo antes de mandar. **Avisa, no frena**: una pieza larga que queda
imprimiendo de noche con mínima por debajo de 15 °C se le dice a Fak con el número, y decide él.
Probado: una pieza de 30 min a las 12:30 no avisa; una de 10 h avisa (mínima 13,2 °C a las 23).

## 1 ter. Vigilar la impresión mirando la cámara (para que no lo haga una persona)

Fak, 13/10/2026: *"quedarte en modo escucha y revisar cada tanto, determinar si conviene frenarla
y en todo caso vos la frenás… es importante para que un humano no se quede haciendo eso"*.
Autorización suya, durable: **si veo una falla clara, la pauso yo** y le aviso.

**Dos capas, porque cuestan distinto:**

| Capa | Cada cuánto | Qué ve | Costo |
|---|---|---|---|
| El script lee el estado de la impresora | 60 s | lo que detecta la propia máquina: pausa, error, alarma (`hms`), 15 min sin avanzar. El arranque de la A2L deja prendidas la detección de «impresión en el aire» y la del cargador | nada |
| Yo miro una foto de la cámara | capa 1, capas 2-3, cada cambio de color y **cada 10 min** | pieza despegada, fideos, pegote en la boquilla, pieza corrida | un turno mío cada vez |

**Cómo se corre:** `bambu_red.py --seguir <carpeta> --fotos-en <capas> --despertar 10` en segundo
plano. Cuando sale con **código 10** hay una foto `*_REVISION.jpg` nueva: la abro con Read, la
juzgo y **relanzo el mismo comando**. Con 0/1/2/3 no se relanza: terminó, falló, quedó en pausa o
se quedó quieta, y se le avisa a Fak con la foto.

**De dónde sale el intervalo (buscado el 13/10/2026; no hay un número oficial para una persona):**
- Bambu (wiki «Spaghetti detection», series X1/H2): la impresora toma un cuadro cada T segundos,
  **acumula los últimos 10 cuadros** y recién ahí decide; sensibilidad baja/media/alta. No
  encontré que la A2L traiga esa detección: no se da por hecha.
- Detectores de terceros: Obico mira cada 30-60 s y no cuenta las primeras 30 lecturas;
  OctoEverywhere, ~40 s. Los laboratorios que usan Bambu piden **quedarse la primera capa** (UT
  Dallas: las primeras 3 a 5 capas).
- Mi revisión cuesta un turno, así que no puede ir cada 40 s: va **densa donde las fuentes dicen
  que falla (primeras capas, cambio de filamento) y cada 10 min después**. Diez minutos de una
  pieza de 60 g son ~6 g: lo que se pierde como mucho si no la veo antes.

**Filtro sin tokens (13/10/2026, EN PRUEBA): el modelo de PrintGuard.** `detector_fallas.py`
corre el modelo abierto de PrintGuard (5 MB, solo `onnxruntime`; entorno en
`C:\Dev\_printguard\.venv`, copia para reinstalar en `2- SOFTWARE\DETECTOR DE FALLAS IMPRESION 3D
(PrintGuard)\` de la nube). Da dos distancias por foto: a «sana» y a «fallada».
`--seguir ... --solo-medir` lo registra una vez por minuto sin dar alarma; `--detector` da la
alarma (salida 11) si tres fotos seguidas superan el umbral (0,45, o 1,8 veces la base de esa
impresión). Medido: 5 fotos sanas de la A2L → «sana» con 0,23 a 0,27; 12 fallas reales de Wikimedia
→ 7 detectadas y 5 no (se le escapa una capa corrida); un enredo real pegado sobre la pieza sube
la distancia con su tamaño (0,24 → 0,29 → 0,70 → «fallada»). **No decide: elige cuándo miro yo.**
Hasta tener el registro de varias impresiones enteras (y alguna falla real), mi mirada cada 10 min
sigue; la meta de Fak es pasarla a cada 30 min cuando el filtro esté validado.

**En una PC nueva el detector se instala solo:**
`python .claude/skills/impresion-3d-bambu/scripts/instalar_detector.py --probar` copia el modelo
desde `2- SOFTWARE\DETECTOR DE FALLAS IMPRESION 3D (PrintGuard)\` de la nube de Ingeniería a
`C:\Dev\_printguard\`, arma el entorno (unos 100 MB) y comprueba que contesta. Si ya está, no toca
nada. Correrlo antes del primer `--seguir --detector` en esa PC.

**Lo que dice Bambu de esta impresora está en `reference/bambu-a2l-oficial.md`** (wiki oficial de
la A2L, leída el 13/10/2026, con la página de cada dato): la placa y por qué se despega una pieza,
lo que la impresora detecta sola, materiales y placas admitidas, y el mantenimiento por horas y
por rollos. **Se lee antes de contestar cualquier cosa sobre la impresora.** Lo que más importa:
- **La placa se lava con agua tibia, detergente y esponja; alcohol no (desparrama la grasa en la
  textura), acetona nunca. No se toca con los dedos.** En Barack se venía limpiando con alcohol
  (Fak, 13/10/2026): si una primera capa falla, esto va antes que tocar el modelo o el laminado.
- La pieza se saca con la placa a temperatura ambiente, flexionando la chapa.
- **La A2L no detecta enredos por cámara.** Detecta sola pegote en la boquilla, impresión en el
  aire y filamento trabado, y pausa; el control fijo de pegote termina a los 10 mm de altura. De
  ahí para arriba, la cámara es lo único que mira.

**Regla para frenar (copiada de los detectores: una sola imagen no alcanza):**
1. Si una foto muestra algo raro, **saco otra a los 60-90 s** (`--foto`). Si las dos muestran lo
   mismo y es claro (fideos, pieza despegada o corrida, pegote creciendo), **`--pausar`**. Pausar
   se puede deshacer; cancelar no.
2. Le aviso a Fak con las dos fotos y lo que vi. **Cancelar lo decide él**, salvo que la pieza
   ya esté claramente perdida y siga tirando material.
3. Ante la duda (foto oscura, reflejo, el cabezal tapa la pieza): no se frena, se saca otra.

**Límite que hay que decir:** la cámara de la A2L mira desde el borde de la cama, baja y de lejos.
Se ven las fallas gruesas; **no** se ve una capa floja, una sub-extrusión leve ni el detalle del
grabado. «No vi nada raro» no es «salió bien»: eso lo dice la pieza en la mano.

## 2. El comando

```bash
python .claude/skills/impresion-3d-bambu/scripts/laminar_bambu.py <pieza.3mf> <carpeta NUEVA> \
    --filamento "Bambu PLA Basic" --filamento "Bambu PLA Basic" \
    --color "#F4D31F" --color "#000000" \
    --parte-filamento "1=2" --parte-filamento "2=1"
```

- `--filamento` una vez por filamento, en el orden de los lugares del cargador (1, 2, 3, 4). El
  nombre es el del perfil de Bambu Studio sin la parte `@BBL A2L…`.
- `--parte-filamento "N=F"`: la parte N del objeto va con el filamento F. Bambu Studio **renombra
  las partes** al importar (`<objeto>`, `<objeto>_2`), por eso se asigna por número.
- Deja `<pieza>.gcode.3mf` (lo que se abre o se manda) y `resumen.json`. **No pisa** una carpeta
  con archivos y no manda nada a la impresora.

El `.3mf` de entrada con dos colores es **un objeto con dos partes** en las mismas coordenadas
(lib3mf: un `ComponentsObject` con dos componentes y un solo build item). Dos objetos sueltos
caen cada uno a la cama. Patrón: `C:\Dev\_utrim\build_v14_etiqueta.py`.

**Pieza resistente o ajustes del perfil:** `--ajuste clave=valor`, las veces que haga falta, con
los nombres de Bambu Studio (`wall_loops`, `sparse_infill_density`, `top_shell_layers`,
`bottom_shell_layers`). Frena si la clave no existe en el perfil (salvo `brim_type`, que el perfil no trae: borde de adherencia). El perfil estándar de la A2L
trae 2 paredes, 15 % de relleno, 5 capas arriba y 3 abajo. Para una pieza que recibe golpes o
cortes (molde de probetas, 13/10/2026): 5 paredes, 25 % de relleno, 6 capas arriba y 5 abajo.
**Más paredes y relleno multiplican el tiempo**: ese molde (1040 cm³) dio 10 h 49 min y 599 g.

**Antes de mandar, el tiempo se le dice a Fak si la impresión no termina con gente en la planta.**
Un «dale, mandala» dado sin saber cuánto tarda no cubre una impresión que queda sola de noche:
se lamina, se le muestra tiempo, gramos, hora en que termina y el aviso de ambiente, y decide él
(13/10/2026: el molde terminaba pasada la medianoche con mínima de 12,8 °C; no se mandó).

**Un color solo en las capas de arriba de una zona** (marca, casillero, etiqueta): se parte la
pieza en cuerpo + una tapa fina (0,8 mm = 4 capas) que es parte aparte, y cada una con su
filamento. Solo hay cambios de color en esas 4 capas. Patrón: `_partir.py` del molde, en
`exports/impresion_3d/molde_probeta_50x50_20261013/` (corta sobre el B-Rep con build123d; la malla
del STL no cierra como volumen y las booleanas de malla no la aceptan).

**Un `.3mf` armado para otra impresora más grande** (14/10/2026: el soporte de microscopio de Leo, hecho
para una Elegoo Neptune 4 Max de cama 420): sin más, Bambu Studio frena con «objects are located over the
boundary of the heated bed». `--acomodar` le pide que reacomode las piezas (`--arrange 1`). Si no entran
en una placa las reparte en varias, y **el script frena** (salida 1, `"placas": N` en `resumen.json`)
porque el resumen, los controles y `bambu_red.py --imprimir` miran solo la placa 1; `--imprimir` tampoco
manda un archivo de varias placas. Se parte la entrada en un `.3mf` por placa (sacando del
`3D/3dmodel.model` los `<item>` y de `Metadata/model_settings.config` los `<object>`, `<model_instance>` y
`<assemble_item>` de lo que no va) y se lamina cada uno. Ojo: con soportes en árbol las piezas ocupan más
y salen más placas (Leo: 1 placa sin soportes ni ajustes; 2 con soportes en árbol y 3 paredes).

**La carpeta de salida va con ruta relativa o absoluta**: el script la resuelve (13/10: con una
relativa Bambu Studio escribía en otro lado y el laminado «fallaba» sin mensaje).

## 3. Las tres trampas (las tres dieron "Success" con un código que no servía)

1. **La herencia de los perfiles no se resuelve sola.** Pasarle a `bambu-studio.exe` los `.json` del
   sistema tal cual dio boquilla 200 °C, flujo 1, densidad 0 y un solo filamento. El script
   **aplana** cada perfil (padre primero, hijo encima) y le pone su `*_settings_id`.
2. **El arranque propio de la máquina vive en plantillas aparte** (`include` en el perfil de la
   A2L: arranque, cambio de filamento, final). Sin incluirlas, el código sale con el arranque
   genérico: lamina bien y no es para esa impresora.
3. **Cargar perfiles sobre un `.3mf` que ya trae los suyos falla** («printer is not compatible
   with the process preset in the 3mf»). Por eso son **dos pasadas**: la primera lamina con los
   perfiles aplanados y deja un `.3mf` de Bambu con todo adentro; la segunda asigna el filamento
   de cada parte y lamina ese archivo sin cargar perfiles.

4. **El archivo sale sin el identificador del modelo de impresora** (`printer_model_id` vacío: ese
   dato vive en el json del modelo, `model_id`, que para la A2L es `N9`). El script lo completa
   en la copia final; el código no se toca (se comprueba el md5 interno).
5. **La miniatura del archivo miente en dos colores**: por comando sale toda de un color. Lo que
   dice quién imprime qué es el código:
   `python .claude/skills/impresion-3d-bambu/scripts/quien_imprime_que.py <carpeta>/plate_1.gcode`
   (por filamento: capas, mm y el rectángulo que ocupa sobre la pieza; el del grabado tiene que
   medir lo que mide el grabado).

## 4. Los controles (el script sale con 1 si alguno falla)

- La temperatura de boquilla del código es la del perfil del filamento.
- El laminado salió en UNA placa (con `--acomodar` puede repartir en varias: ver §2).
- La densidad no es 0 (el perfil de material se cargó).
- Si se pidieron varios filamentos, el código cambia de filamento.
- El arranque del código es el de la plantilla de esa impresora.

Y uno que hago yo, mirando `resumen.json`: **los gramos por filamento tienen que tener sentido con
el volumen de cada parte.** El 13/10 un reparto 29 g / 24 g con un grabado de 0,04 cm³ fue lo que
destapó la trampa 2.

## 5. Antes de entregar

- **Material: Bambu PLA Lite** (Fak, 13/10/2026: los rollos amarillo, negro y blanco son PLA Lite
  de Bambu) → `--filamento "Bambu PLA Lite"`. Si cambia de rollo, se le pregunta: **el material no
  se asume** (memoria `reference_impresora_3d_fak`, el caso del PETG).
- **Cama: la estándar de la A2L, «Textured PEI Plate»** (55 °C con PLA). El script la toma sola del
  json del modelo (`default_bed_type`) y frena si se pide una que el modelo no admite. Sin eso, por
  comando salía «Cool Plate» a 35 °C, que la A2L no soporta (`not_support_bed_type`): la primera
  versión del archivo del 13/10 salió así y se reemplazó. Otra cama: `--cama "<nombre>"`.
- El archivo va a la carpeta de la pieza en la nube de Ingeniería (`1- GENERAL\5. 3D\...`), con
  el tiempo y los gramos en el mensaje.
- La pieza en sí pasa primero por los gates del skill `cad-design`.

## 6. Los otros programas de `scripts/`

| Programa | Para qué |
|---|---|
| `imprimir_pieza.py` | De un STEP o 3MF a la impresora en un solo paso: lamina, muestra el plan y, con `--apply`, manda |
| `vista_previa.py` | La imagen de cómo queda la pieza con sus colores, antes de imprimir (para que Fak la valide) |
| `reporte_laminado.py` | En qué se va el tiempo y el material de un laminado (paredes, relleno, cambios de color) |
| `video_impresion.py` | Un video corto con las fotos de `--seguir` |
| `quien_imprime_que.py` | Qué filamento imprime cada capa: el control de los colores (la miniatura del archivo no sirve) |
| `registro.py` | Horas, gramos por rollo y mantenimiento que toca, sumando lo que anotó cada PC |
