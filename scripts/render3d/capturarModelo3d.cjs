// capturarModelo3d.cjs — vistas limpias (PNG) de un modelo 3D en HTML de Claude Design, sin abrir ventana.
//
// Uso:
//   node scripts/render3d/capturarModelo3d.cjs --html <modelo.html> --out <carpeta> --tomas <tomas.json> [--ocultar B,C] [toma1 toma2 ...]
//
//   --html     el .html del modelo (three.js con <three-d-stage> y window.taller, como los que exporta Claude Design)
//   --out      carpeta donde caen los PNG (se crea si no existe); un archivo <n>.png por toma
//   --tomas    .json con la lista de tomas. Cada toma:
//                { "n": "nombre", "view": "iso|planta|frontal|lateral" }          vista del panel, o
//                { "n": "nombre", "pos": [x,y,z], "tgt": [x,y,z] }                camara libre (coordenadas del mundo three.js)
//              y ademas, opcionales:
//                "layers": { "labels": false, "cotas": false, ... }  capa en false = apagada; la que no se nombra queda prendida
//                           (muros, cubierta, mobiliario, equipos, aire, electrica, salidas, cotas, labels)
//                "cut": 2.6       corte de muros en metros (sin "cut" = muros enteros)
//                "night": true    modo noche (LED)
//              Ejemplo: scripts/render3d/tomas-ejemplo.json
//   --ocultar  IDs de items del modelo a esconder, separados por coma (se esconde el objeto y su etiqueta)
//   toma1 ...  nombres de tomas a correr; sin nombres corre todas
//
// Salida: 1600x900 con deviceScaleFactor 2 = 3200x1800 (16:9, igual que la imagen que devuelve Gemini).
//
// Las dos trampas (memoria reference_render_headless_modelo_3d_html, 23/09/2026):
//   1. Edge + GPU. Con el chromium_headless_shell y SwiftShader la pagina carga, pero page.screenshot
//      se cuelga hasta el timeout. Por eso: channel 'msedge' y --ignore-gpu-blocklist --enable-gpu.
//   2. Cortar el loop y renderizar cuadro a cuadro. Con el loop de animacion andando la captura no
//      cierra: se hace setAnimationLoop(null) y por cada toma se pone la camara, controls.update(),
//      stage.onFrame() (proyecta las etiquetas HTML) y un renderer.render() a mano.
//
// Una vista que va a pasar a "foto real" se saca a la altura de los ojos (y = 1,65), sin muros
// cortados, sin etiquetas ni cotas: skill render-a-foto-real.

const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const USO = [
  'Uso: node scripts/render3d/capturarModelo3d.cjs --html <modelo.html> --out <carpeta> --tomas <tomas.json> [--ocultar B,C] [toma1 toma2 ...]',
  '  Ejemplo de tomas: scripts/render3d/tomas-ejemplo.json',
  '  Detalle y trampas: cabecera de este archivo y skill render-a-foto-real.',
].join('\n');

function leerArgs(argv) {
  const a = { html: null, out: null, tomas: null, ocultar: [], solo: [], ayuda: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--help' || k === '-h') a.ayuda = true;
    else if (k === '--html') a.html = argv[++i];
    else if (k === '--out') a.out = argv[++i];
    else if (k === '--tomas') a.tomas = argv[++i];
    else if (k === '--ocultar') a.ocultar = String(argv[++i] || '').split(',').map(s => s.trim()).filter(Boolean);
    else if (k.startsWith('--')) throw new Error('argumento desconocido: ' + k);
    else a.solo.push(k);
  }
  return a;
}

function leerTomas(ruta) {
  const tomas = JSON.parse(fs.readFileSync(ruta, 'utf8'));
  if (!Array.isArray(tomas)) throw new Error('el .json de tomas tiene que ser una lista: ' + ruta);
  for (const t of tomas) {
    if (!t.n) throw new Error('toma sin "n": ' + JSON.stringify(t));
    const libre = Array.isArray(t.pos) && Array.isArray(t.tgt);
    if (!t.view && !libre) throw new Error('la toma "' + t.n + '" necesita "view" o "pos" + "tgt"');
    t.layers = t.layers || {};
  }
  return tomas;
}

async function main() {
  const argv = process.argv.slice(2);
  let a;
  try { a = leerArgs(argv); } catch (e) { console.error(e.message); console.error(USO); process.exit(1); }
  if (argv.length === 0 || a.ayuda) { console.log(USO); return; }
  const falta = ['html', 'out', 'tomas'].filter(k => !a[k]);
  if (falta.length) { console.error('Falta: --' + falta.join(', --')); console.error(USO); process.exit(1); }
  for (const k of ['html', 'tomas']) {
    if (!fs.existsSync(a[k])) { console.error('No existe --' + k + ': ' + a[k]); process.exit(1); }
  }

  const TODAS = leerTomas(a.tomas);
  const noHay = a.solo.filter(n => !TODAS.some(t => t.n === n));
  if (noHay.length) { console.error('Tomas que no estan en ' + a.tomas + ': ' + noHay.join(', ')); process.exit(1); }
  const TOMAS = a.solo.length ? TODAS.filter(t => a.solo.includes(t.n)) : TODAS;
  fs.mkdirSync(a.out, { recursive: true });

  const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
  const url = pathToFileURL(path.resolve(a.html)).href;

  const b = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
    p.on('console', m => { if (m.type() === 'error') console.log('console:', m.text()); });
    p.on('pageerror', e => console.log('pageerror:', e.message));
    await p.goto(url, { waitUntil: 'load' });
    await p.waitForFunction(() => window.taller, null, { timeout: 120000 });
    // Esconder la interfaz: panel, barra de vistas, y dentro del shadowRoot la toolbar y la nota
    await p.addStyleTag({ content: '.app{grid-template-columns:1fr !important} aside.panel,.viewbar{display:none !important}' });
    await p.evaluate((ocultar) => {
      const st = document.createElement('style');
      st.textContent = '.toolbar,.note{display:none !important}';
      document.querySelector('three-d-stage').shadowRoot.appendChild(st);
      window.dispatchEvent(new Event('resize'));
      for (const id of ocultar) {
        const it = window.taller.itemById && window.taller.itemById[id];
        if (it) it.obj.visible = false;
        document.querySelectorAll('#labels .lbl.item').forEach(el => {
          const n = el.querySelector('.n');
          if (n && n.textContent === id) el.remove();
        });
      }
    }, a.ocultar);
    await p.waitForTimeout(1500);
    // Trampa 2: render cuadro a cuadro
    await p.evaluate(() => document.querySelector('three-d-stage')._renderer.setAnimationLoop(null));

    const LAYER_KEYS = ['muros', 'cubierta', 'mobiliario', 'equipos', 'aire', 'electrica', 'salidas', 'cotas', 'labels'];
    for (const s of TOMAS) {
      await p.evaluate(({ s, LAYER_KEYS }) => {
        const cbs = [...document.querySelectorAll('#layers input')];
        LAYER_KEYS.forEach((k, i) => {
          if (!cbs[i]) return;
          const want = s.layers[k] !== false;
          if (cbs[i].checked !== want) { cbs[i].checked = want; cbs[i].dispatchEvent(new Event('change')); }
        });
        const h = document.getElementById('height');
        const cut = s.cut || 4;
        if (h && +h.value !== cut) { h.value = cut; h.dispatchEvent(new Event('input')); }
        const nb = document.getElementById('night');
        if (nb) {
          const on = nb.getAttribute('aria-pressed') === 'true';
          if (!!s.night !== on) nb.click();
        }
        const stage = document.querySelector('three-d-stage');
        if (s.view) window.taller.setView(s.view, 0);
        else { stage._camera.position.set(...s.pos); stage._controls.target.set(...s.tgt); }
        stage._controls.enableDamping = false;
        stage._controls.update();
        stage.onFrame();
        stage._renderer.render(stage._scene, stage._camera);
      }, { s, LAYER_KEYS });
      await p.waitForTimeout(500);
      await p.screenshot({ path: path.join(a.out, s.n + '.png'), timeout: 120000 });
      console.log('ok', s.n);
    }
  } finally {
    await b.close();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
