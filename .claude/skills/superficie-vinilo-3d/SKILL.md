---
name: superficie-vinilo-3d
description: >
  Medir sobre el 3D cuanta superficie de una pieza va tapizada (vinilo, TPO, tela): lo que
  queda a la vista, el borde que se dobla y la pieza de material entera; cruzarlo con el patron
  de corte, la lista del cliente y el consumo del arb; y entregarlo en un PowerPoint con su
  evidencia. Usar cuando pidan "la
  superficie donde va el vinilo", "cuantos m2 tiene la pieza", "cuanto material lleva", "el
  consumo actual del proceso con una imagen", o cuando haya que demostrar un consumo de
  tapizado con el 3D.
---

# superficie-vinilo-3d — cuanto tapizado lleva una pieza, medido y demostrado

Nacio el 01/10/2026: el dueño le pidio a Carlos por audio *"la superficie que tiene toda la
parte de arriba del Top Roll, donde va el vinilo, en metro cuadrado, del trasero y del
delantero"*. Fak: *"hiciste un muy buen laburo... es una tarea que vamos a repetir en el futuro
muy cercano"*. El caso completo, con sus numeros y sus rutas: `examples/top_roll_patagonia/`.

## 0. Que se entrega (lo que le gusto a Fak)

Tres numeros por pieza, y **no se mezclan**: son tres magnitudes distintas.

| Numero | Que es | De donde sale | Que tan firme |
|---|---|---|---|
| **A la vista** | la piel apoyada en la cara de adelante, hasta donde empieza el doblez | cuenta propia sobre el 3D (§3) | aproximado: se informa a 2 decimales y se dice el rango |
| **Borde que se dobla** | la solapa que pasa del canto y va pegada atras | total menos a la vista | idem |
| **Total de la pieza** | la pieza de material ya recortada | area EXACTA de la piel del 3D | firme: se cruza con el patron y la lista del cliente |
| *Consumo del proceso* | la lamina que entra a la maquina, por pieza | arb + pantalla de la maquina + ancho de rollo | es otra cosa: incluye el recorte |

Entregable: **un PowerPoint** (16:9, una idea por hoja, el numero grande en una caja de color)
guardado en la biblioteca de Ingenieria, carpeta de consumos de la pieza
(`1- GENERAL\2. CONSUMO DE MATERIAL BOM\BOMS\<cliente>\<proyecto>\<pieza>\`), y el mail.
Orden de las hojas que funciono: respuesta · una hoja por pieza con el 3D pintado ·
consumo actual del proceso · el mismo dato en otros documentos · **una hoja de evidencia por
cada fuente citada**. Las primeras son para el que pregunta; la evidencia va al final.

## 1. Antes de medir

1. **Escuchar el pedido original** (audio: memoria `extraer_video_audio_local`; Whisper escribe
   "terror" donde dicen "Top Roll") y **decirle a Fak en cinco renglones que entendi** antes de
   tocar nada. Lo pidio el: *"confirma que entendiste la tarea primero"*.
2. Usar SUS palabras: dice "vinilo" aunque el material sea TPO con espuma. No se discute.
3. **Buscar el 3D que trae la PIEL**, no solo el sustrato. No se identifica por el nombre:
   se abre. En el Top Roll la nota de la carpeta decia que no habia archivo del tapizado y los
   dos que lo traian estaban en una subcarpeta con otro nombre (`Final Trimmed Skin`).
   Mapa de 3D de Patagonia: memoria `patagonia_3d_door_pieces`.
4. Copiar los STEP a una carpeta de trabajo local (del servidor no se trabaja).

## 2. Que puede traer un STEP, y que se hace con cada caso

`sv_modelo.py` lo dice en su resumen (solidos y "pieles sueltas" con su area exacta).

| Lo que trae | Que es | Que se informa |
|---|---|---|
| sustrato + **2 pieles** | la TERMINADA (doblada, del cliente; pegada al plastico) y la RECORTADA (con las solapas hacia afuera, del que hace el herramental) | **todo**: a la vista = donde coinciden; total = la recortada |
| sustrato + **1 piel** | una de las dos | **solo el total** (exacto). "A la vista" no se informa: sin la segunda piel habria que adivinar donde empieza el doblez. Si la piel es la terminada, el total es el de la piel ya doblada, que mide menos que la pieza recortada |
| **solo sustrato** | — | **ningun numero**. Quedan las dos caras continuas mas grandes del plastico como candidatas, pintadas en la foto, para elegir mirando |
| otro solido ademas del sustrato | refuerzo, soporte | se dibuja gris oscuro, no se mide |

**"A la vista" solo sale con las dos pieles.** Los otros dos modos daban numeros con buena cara
y falsos (auditoria del 01/10/2026): por eso informan menos. Si el pedido es "lo que se ve" y el
3D trae una sola piel, se busca el 3D con la otra o se dice que no se puede.

**La piel va unos 2 mm por fuera del plastico** (espesor del material) y el medidor lo exige:
una superficie suelta que no esta apoyada en el sustrato, o que esta a menos de 0,3 o a mas de
6 mm, no se acepta como piel. Para un material mas grueso, `--apoyo`.

## 3. Los pasos (y lo que tarda cada uno en esta notebook)

`PY` es el Python de CAD y `SV` la carpeta de las herramientas, con la ruta entera (ojo: el repo
tiene otra carpeta `scripts\` en la raiz, que no es esta):

```
PY = C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe
SV = C:\Dev\BarackMercosul\.claude\skills\superficie-vinilo-3d\scripts
W  = una carpeta de trabajo local (en el scratchpad)

PY SV\sv_modelo.py  <pieza.step> W\del_modelo.npz [--ejes x,-z,y]     # 3-8 min por archivo de 15-66 MB
PY SV\sv_medir.py   W\del_modelo.npz W --clave del [--hueco "nombre:x0,x1,z0,z1"]   # 1-3 min
PY SV\sv_fotos.py   W\del_modelo.npz W\del_clases.npz W --clave del   # 1-2 min
PY SV\sv_selftest.py                                                   # 2 min: antes de creerle a un cambio del medidor
```

Con el `python` del sistema (tiene python-pptx):

```
python C:\Dev\BarackMercosul\.claude\skills\superficie-vinilo-3d\examples\top_roll_patagonia\armar_presentacion.py W "W\<nombre>.pptx"
```

Que deja cada paso en `W`:

| Paso | Deja | Lo usa |
|---|---|---|
| `sv_modelo` | `<clave>_modelo.npz` (cache) y `<clave>_modelo.json` (resumen: solidos y pieles) | `sv_medir`, `sv_fotos` |
| `sv_medir` | `<clave>_numeros.json` (los numeros, con su glosario) y `<clave>_clases.npz` | `sv_fotos`, la presentacion |
| `sv_fotos` | `<clave>_pintada.png`, `<clave>_atras.png`, `<clave>_terminada.png` | la presentacion |

- **`--ejes`**: hace falta cuando el archivo no esta en ejes de auto. Se ve en el resumen de
  `sv_modelo`: la caja del sustrato tiene que salir con el largo en X y el alto en Z. Los STEP
  exportados de **Onshape** (lo dice su encabezado: `ONSHAPE BY PTC`) pueden venir con Y hacia
  arriba: `--ejes x,-z,y`. Los de CATIA del cliente vienen bien. Si el primer eje es negativo
  se escribe con igual: `--ejes=-x,z,y`.
- **El sustrato se elige solo**: el solido cuya caja coincide con la de la piel. Lo imprime
  (`SUSTRATO: solido N`). Si hay varios solidos y no puede distinguir, se niega y pide
  `--sustrato N` (el numero es el del resumen de `sv_modelo`).
- **Codigos de salida de `sv_medir`**: `2` = no pudo medir sin adivinar; no escribe nada y dice
  por que. `0` = hay numeros; con una piel el renglon dice *"A LA VISTA: no se informa"*. Las
  dos cosas son resultados: se le dicen a Fak tal cual.
- **Colores de las fotos**: azul = a la vista · naranja = borde que se dobla (y huecos) ·
  violeta = sin repartir (la piel entera cuando hay una sola; la segunda candidata cuando no
  hay piel) · gris = plastico · gris oscuro = otros solidos · negro = la pieza terminada.
- **La camara** mira de frente a la cara vista (medido); `--elev/--azim` la fuerzan. Si
  imprime `POR DEFECTO`, no habia cara vista medida y hay que darselos.
- **Memoria**: `sv_modelo` y `sv_medir` usan hasta 3 GB cada uno con un Top Roll. `sv_modelo`
  imprime la memoria libre y no arranca con menos de 2 GB. De a un archivo por vez si hay
  agentes u otra sesion pesada corriendo.
- Otras opciones de `sv_medir`: `--tol` (hasta que distancia las dos pieles "coinciden",
  0,3 mm) y `--apoyo` (hasta que distancia la piel esta "apoyada", 3 mm).

## 4. Como se explica cada numero (Fak lo va a preguntar)

*"Esos 0,10 los tuviste que calcular vos solito, ¿no? ¿como sabes que lo hiciste perfecto?"*
La respuesta honesta, que es la que hay que tener lista:

- **El total esta respaldado**: es el area exacta de la piel del 3D, y se cruza con otros
  documentos. Si el cruce no cierra, se muestra igual, con las fechas de cada fuente.
- **"A la vista" es una cuenta propia y es aproximada.** No esta en ningun documento porque
  nadie lo necesita para fabricar. Sale de comparar las dos pieles; el limite (donde empieza
  el doblez) se puede correr unos milimetros. `sv_medir` da el rango y dice si es estable a
  2 decimales: si no lo es, **se informa el rango, no un numero**.
- **Respaldo propio, cuando lo hay**: si la cara del plastico se pudo separar por continuidad
  (`se_cuela_al_dorso: false`), tiene que dar un poco MENOS que la tapizada, y el medidor avisa
  si no. En el Top Roll delantero lo hubo (932 cm² de plastico contra 960 de tapizado); en el
  trasero no, porque la continuidad se cuela: ahi "a la vista" se apoya solo en la comparacion
  de las dos pieles, y se dice. `sustrato_cubierto_por_rayos_cm2` NO es "a la vista": cuenta
  tambien el plastico que tapa el doblez.
- **Lo que NO se puede asegurar se dice**: "a la vista" es de la pieza suelta; montada en la
  puerta, otra pieza puede tapar una parte.
- Para un pedido importante, **una medicion de control con otro programa** (gmsh) por un
  agente al que no se le dicen los numeros. En el Top Roll coincidio al centesimo en las areas
  y al 1 % en el reparto. Tardo una hora: se lanza al principio, no al final.

## 5. Los cruces (cada uno es otra magnitud: se nombra la magnitud)

| Fuente | Donde | Que dice |
|---|---|---|
| Patron de corte (DXF) | legajo `13-Especificaciones de Ingenieria F\02 -Computo Tizada de Corte...\<pieza>\` | area de la pieza cortada, en plano (`svlib_capturas.contorno_dxf`) |
| Lista de materiales del cliente | legajo `13-...\01- Documentacion <cliente>\` | superficie que declaro el cliente al cotizar |
| BOM del arb | export RELACIONES de `.arb-cache\` y el PDF de `7-...\01_BOM MATERIAL\` del legajo | **consumo**: metro lineal de rollo por pieza |
| Ancho de rollo | orden de compra en `Z:\arb\oc\ocauto\BA\` | para pasar el metro lineal a m2 |
| Largo de lamina y piezas por lamina | pantalla de la maquina y foto del molde (`5- VIDEOS Y FOTOS\...\<maquina>\.claude\fotogramas de cada video\`) | el consumo del proceso con imagen |

Los datos de consumo traen su papel (regla `consumos-entregables.md`). Si una fuente es de
otra fecha que el 3D y no cierra, van las dos con su fecha: no se elige ni se explica por que
difieren (`core-prohibiciones` §1).

## 6. La presentacion

`examples/top_roll_patagonia/armar_presentacion.py` es **el ejemplo a copiar**: arriba van las
rutas y los textos del caso; abajo, el armado. Usa `svlib_lamina.py` (hojas, cajas, tabla,
barra) y `svlib_capturas.py` (evidencia).

- **Los numeros MEDIDOS los escribe el codigo** desde `<clave>_numeros.json`. `numeros()` frena
  si el 3D no traia las dos pieles, si el medidor dejo un aviso sin resolver, si "a la vista" no
  es estable a 2 decimales o si las partes no cierran con el total. Los que se LEEN de un
  documento (lista del cliente, largo de lamina, piezas por lamina) van tipeados arriba del
  script, al lado de su fuente, y cada uno lleva su captura en una hoja de evidencia.
- **Un patron DXF con el contorno abierto no se cierra en silencio**: `contorno_dxf` aborta, y
  si se acepta cerrarlo (`hueco_max_mm`), la hoja lo dice al pie.
- **Si nombro una fuente, va su captura** (Fak: *"si no me van a preguntar de donde saque los
  datos"*): recorte del documento real, el renglon marcado en rojo, y abajo archivo, fecha y
  carpeta. De una orden de compra, **sin los precios**.
- **"Consumo actual del proceso" = una imagen del proceso real** (el molde con sus cavidades,
  la pantalla con el largo de lamina) y la cuenta: lamina → piezas por lamina → m de rollo y m2
  por pieza → cuanto queda en la pieza y cuanto es recorte. Las fotos con caras de personas no
  se usan si hay una sin gente.
- Siempre **exportar a PNG y MIRAR cada hoja** antes de entregar (`exportar()`): texto que se
  pisa, cajas que cortan el numero.
- Guardar en la biblioteca, medir que subio (`scripts/_nubeSubio.ps1`) y mandarle a Fak el PDF
  por el chat (`SendUserFile`) ademas de la ruta.

## 7. El mail

Borrador con `scripts/_prepararMail.py` (queda abierto en Outlook), **se le muestra a Fak**, y
se envia con `scripts/_mailEnviar.py --enviar` solo con su OK para ese mail (regla
`mail-envio.md`). Para el pedido del dueño del 01/10: Para Pedro Ergo, Andres Santoro y Carlos
Baptista. Cuerpo de dos renglones con el numero adelante. Un reenvio con cambios lleva **otro
asunto** (el control de duplicados compara asunto + destinatarios + adjunto).

## 8. Trampas ya pisadas

- `analyze_step.py --solids-only` (cad-design) sobre STEP de 45-66 MB: no termino en 10 min.
  Aca se carga una vez (`sv_modelo.py`) y se cachea con la firma del archivo.
- **`trimesh.remesh.subdivide_to_size` revienta la memoria** con los triangulos finitos y
  largos de una piel (5,9 GB). `sv_medir` parte por el lado mas largo.
- **La cara del sustrato por continuidad de caras a veces se cuela al dorso** por un borde
  redondeado (Top Roll trasero: 85 % del sustrato, la mitad mirando al reves). El medidor lo
  detecta por dos señales (fraccion del sustrato y area que mira al reves) y no la usa. Los
  umbrales salieron de dos piezas reales: no son ley.
- Una superficie suelta lejos de la pieza hacia morir al medidor por memoria en vez de
  negarse: ahora los puntos lejanos no entran a la busqueda y el resto va en tandas.
- El `pdftotext` del PATH es el xpdf viejo, sin `-bbox`: se usa el de poppler.
- OneDrive le cambia el tamaño al .pptx al subirlo: que el archivo de la biblioteca no sea
  byte a byte el que copie no significa que alguien lo edito (mirar la hora).
- La auditoria del primer dia encontro numeros falsos en los modos que yo no habia usado (una
  piel, sin piel): **lo que no se corrio con un caso de respuesta conocida, no se informa.**

## 9. Cuando se toca el medidor

1. `sv_selftest.py`: los **diez** casos (dos que tienen que dar el numero, dos que dan solo el
   total o nada, seis en los que el medidor **se tiene que negar**).
2. Volver a generar los `*_modelo.npz` del caso real con `--forzar` si se toco `sv_modelo.py`
   (y subirle `VERSION`), correr `sv_medir.py` y despues
   `python examples\top_roll_patagonia\comprobar_referencia.py W`: total al centesimo, reparto
   al 1 %, y contra la medicion de control hecha con gmsh.

Sin las dos cosas no se entrega un numero con el medidor cambiado. Y un cambio del medidor lo
ataca alguien que no lo escribio (el auditor encontro seis fallas reales en la primera version).

## 10. Lo que todavia no hace

- "A la vista" con una sola piel o sin piel: no lo da (a proposito).
- Mas de dos pieles en un STEP, o un STEP sin ningun solido: se niega.
- Dos pieles iguales y planas corridas de costado no se distinguen de dos bien puestas: en una
  pieza curva si (se niega o marca que el numero cambia).
- El modo sin piel y el detector de "se cuela" no tienen un caso curvo en el selftest.
- Piezas donde la piel no envuelve un sustrato rigido (fundas, costuras): no aplica.
- "A la vista con la pieza montada" (lo que tapa otra pieza): no se mide.
- La mano derecha se da por espejo de la izquierda; solo se midio la izquierda.
