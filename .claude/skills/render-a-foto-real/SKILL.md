---
name: render-a-foto-real
description: Pasar un render o modelo 3D (HTML de Claude Design, STEP renderizado, captura) a imagenes que parezcan fotos reales para un deck o un cliente, incluidas la version nocturna y la vista aerea. Usar cuando haya que convertir un render o una propuesta 3D en imagen fotorrealista.
---

# Render a foto real — vistas del 3D pasadas por el Gemini de Fak

Skill armado el 23/09/2026, la primera vez que se hizo: deck "Taller de Motores" para el
cliente Walter Pirfo. Todo lo de abajo se probo ese dia; lo que no anduvo esta marcado.

**El camino:** vistas base del modelo (Paso 1) → Gemini de Fak en Chrome convierte cada una
(Paso 2) → se mira contra el render → va al deck en el lugar del render.

## Cuando NO

- **Nunca para una imagen que lleva datos a leer**: pantallas de HMI, planos, cotas, valores,
  etiquetas. El modelo redibuja los digitos y el numero que sale no es el que habia. Ahi manda
  la memoria `feedback_pantalla_se_redibuja_no_se_mejora_con_ia` (foto real enderezada, rotulo
  encima).
- Es solo para visualizar una **propuesta**. En el deck se rotula "PROPUESTA" o
  "Visualizacion de ...": nunca se presenta como foto de algo que ya existe.

## Los errores caros (medidos el 23/09)

1. **Sin la regla estricta, Gemini AGREGA muebles.** En la vista aerea puso dos mesas y un carro
   que el plano no tiene.
2. **Corregir en el mismo chat empeora.** Pedirle que sacara lo agregado devolvio algo con cara
   de render otra vez, saco una mesa que SI estaba y agrego tambores. Las correcciones una atras
   de otra derivan. **Lo que anduvo: chat NUEVO con la regla estricta desde el primer mensaje.**
3. **La nocturna no se pide desde el render nocturno** (salio con cara de render). Se sube la
   FOTO de dia ya generada y se pide "cambia SOLO la iluminacion, sin tocar ningun objeto".
4. **Para que varias fotos parezcan del mismo lugar**, se piden en el mismo chat: "otra foto del
   MISMO taller, mismo estilo que la de dia".
5. **Si el render trae numeros o etiquetas, Gemini intenta pintarlos** (y los inventa). Las
   vistas base van limpias.
6. **Una imagen que ya se aprobo no se vuelve a pedir**: cada pedido sale distinto.
7. **Visto desde arriba, un dintel sobre una abertura ES un muro.** Con el porton cambiado por
   "todo abierto" pero dejando la viga superior, Gemini cerro los dos frentes. Si el frente va
   abierto, en el modelo va abierto de piso a techo, y el pedido nombra los lados sin muro
   ("todo el borde de arriba del sector de la izquierda, sin linea blanca de muro").
8. **Gemini avisa cuando no cumplio: leer su texto antes de bajar la imagen.** Dos veces dijo
   "sigue pareciendo cerrado" o "hay una persona reflejada"; ese renglon ahorra una vuelta.

## Paso 1 — las vistas base

- **A la altura de los ojos (1,65 m)**, como la sacaria una persona parada adentro.
- **Sin muros cortados**: una foto real no tiene muros cortados. Sin etiquetas ni cotas.
- Formato 16:9 (el script saca 3200x1800; Gemini devuelve 1365x768, tambien 16:9).
- Script: `scripts/render3d/capturarModelo3d.cjs` (modelos HTML de Claude Design:
  `<three-d-stage>` + `window.taller`). Receta y trampas en la memoria
  `reference_render_headless_modelo_3d_html`: Playwright con `channel: 'msedge'` + GPU (el
  `chromium_headless_shell` con SwiftShader se cuelga en el screenshot) y render cuadro a cuadro.

```bash
node scripts/render3d/capturarModelo3d.cjs --html "<modelo>.html" --out "<carpeta de la tarea>/r3d" \
  --tomas scripts/render3d/tomas-ejemplo.json [--ocultar B] [recinto_ojo ...]
```

Las tomas van en un `.json` (lista de `{n, view | pos+tgt, layers, cut, night}`); el ejemplo
tiene la planta limpia, una toma a la altura de los ojos y su version con LED. `pos`/`tgt` son
coordenadas del mundo three.js, no del plano: en el Taller era mundo = plano - (10; 0; 3,5).
Si el modelo no es de Claude Design (STEP, captura), la vista base se saca con lo que haya
(skill `cad-design` para renders de un STEP), con las mismas tres condiciones.

## Paso 2 — Gemini de Fak en Chrome

En esta PC no hay placa de video ni API de imagenes: generar local no es opcion. Se usa la
cuenta Pro de Fak en `gemini.google.com`, con las herramientas `mcp__claude-in-chrome__*`
(cargarlas juntas en UNA ToolSearch: navigate, computer, find, javascript_tool, file_upload,
read_page, tabs_context_mcp).

**Antes de subir nada: OK de Fak, una vez por trabajo.** Subir imagenes a su cuenta y bajar
archivos piden permiso explicito. Se le dice que se sube (renders + fotos de referencia) y que
se baja a donde.

Mecanica que funciono:

1. Click en **"Cargas y herramientas" (+)**. Abre un menu, y recien ~2 s despues aparece un
   `<input type=file accept="image/*">` oculto (clase `hidden-file-input`).
   **No clickear "Subir archivos"**: abre el selector de Windows y ahi no se puede operar.
2. Hacer visible el input por JS (`javascript_tool`):
   ```js
   (() => { const i = document.querySelector('input[type=file].hidden-file-input');
     if (!i) return false; i.classList.remove('hidden-file-input'); i.style.display = 'block';
     i.setAttribute('aria-label', 'subir imagen claude'); return true; })()
   ```
   Si devuelve `false`, la pagina no habia terminado de cargar: esperar y volver a clickear el +.
3. `find` "subir imagen claude" → `file_upload` con ese ref y rutas ABSOLUTAS, menos de 10 MB
   por llamada. **El render va primero** (el prompt habla de "la PRIMERA imagen"), despues las
   referencias.
4. Escribir el pedido en el textbox "Ingresa una instruccion para Gemini" y Enter. Tarda 30-40 s.
5. Si la imagen generada no carga (recuadro vacio, `img` con `naturalWidth` 0): recargar la URL
   del chat y bajar con scroll.
6. Descargar: hover sobre la imagen → "Descargar imagen en tamano completo" → cae en Descargas
   como `Gemini_Generated_Image_*.jpg` (1365x768). **Moverla enseguida a la carpeta de la
   tarea**, con un nombre que diga que vista es: nada mio queda suelto en Descargas.

## Prompts que funcionaron (plantillas)

**Conversion** (el render primero; las referencias son fotos reales que pase Fak, en el caso
las del taller objetivo):

> Genera una imagen: converti la PRIMERA imagen (render 3D de <que es>) en una fotografia real,
> sacada con una camara profesional, como si <el lugar> ya estuviera construido y en uso.
> Mantene el mismo encuadre, la misma perspectiva y la misma distribucion: <lo que se ve, de
> izquierda a derecha>. Usa las otras imagenes SOLO como referencia de estilo y terminaciones
> reales. No agregues <lo que no va>, ni personas, ni textos, carteles, logos o marcas. Luz
> natural realista, texturas, desgaste y reflejos reales: que no parezca un render. Formato
> horizontal 16:9.

**Regla estricta** (se suma desde el PRIMER mensaje cuando importa la fidelidad, por ejemplo
la vista aerea que se compara con el plano):

> Regla estricta: es un cambio de materiales, texturas y luz, NO de contenido. No agregues ni
> quites ningun objeto: cada mueble, equipo, linea pintada en el piso, caneria, muro y abertura
> del render tiene que aparecer una sola vez, en el mismo lugar y con el mismo tamano, y donde
> el render muestra piso vacio la foto muestra piso vacio.

**Nocturna** (se sube la foto de DIA ya aprobada, no el render nocturno). Lo que hizo que
funcionara fue esta parte del pedido:

> cambia SOLO la iluminacion, sin tocar ningun objeto.

**Otra vista del mismo lugar** (mismo chat): "otra foto del MISMO <lugar>, mismo estilo que la
de dia", con el render nuevo como primera imagen.

## Control de cada imagen bajada

Se abre la imagen y se la mira al lado de su render, no de memoria:

- [ ] Objetos agregados o quitados (muebles, equipos, carros, tambores).
- [ ] Cantidad de luminarias contra el plano.
- [ ] Textos, carteles, marcas o logos inventados.
- [ ] Sigue pareciendo foto (si volvio a cara de render, chat nuevo, no correccion).

Si falla: chat nuevo con la regla estricta (error 2). Si pasa, queda aprobada y no se repide.

## En el deck

- La foto va **donde estaba el render, con el mismo marco**, y el rotulo "PROPUESTA" o
  "Visualizacion de ...".
- Si la vista es la que se compara con el plano, los numeros del plano van encima como
  **circulos que son shapes del pptx**, no pintados en la imagen.
- **Si Fak ya edito el pptx entregado, el cambio se hace SOBRE su archivo**: primero comparar
  que cambio el, despues aplicar, y guardar con otro nombre. Nunca pisar el suyo (memoria
  `feedback_no_pisar_archivo_que_toco_fak`).
- Render de control del pptx antes de entregar (memoria `reference_gen_pdf_pptx`).

## Relacionado

- `reference_render_headless_modelo_3d_html` — la receta del Paso 1 y por que Edge + GPU.
- `feedback_pantalla_se_redibuja_no_se_mejora_con_ia` — el limite: lo que se lee no pasa por IA.
- `reference_gen_pdf_pptx` — armar el pptx y su render de control.
