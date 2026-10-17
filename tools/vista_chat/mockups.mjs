/**
 * mockups.mjs — tres maquetas de cómo se vería el chat con otros colores, para que Fak elija (tanda 6 del plan del
 * sistema, 17/10/2026). Fak, 13/10: «es muy oscuro… pasame una foto de cómo se vería y elijo».
 *
 * No instala nada: dibuja una conversación de ejemplo (texto inventado, ningún chat real) con los colores que el mod
 * `claude-skins` (hellosverre/claude-skins, MIT) trae en su código (`hooks/themes/<skin>.ts`, leídos el 17/10/2026 y
 * copiados abajo tal cual) y la saca a PNG con Playwright, sin abrir ninguna ventana. Arma además un HTML que muestra
 * las tres juntas, con el contraste de cada par de colores calculado (fórmula WCAG; 4,5 es el mínimo para texto).
 *
 * Lo que el skin pinta y lo que no: un skin repinta las cajas de los mensajes, las filas de herramientas, las tablas y
 * el código. El fondo general de la ventana y la letra los pone la app (claro u oscuro); ningún mod cambia la letra.
 * Por eso cada maqueta dice de dónde sale cada color: del skin, o propuesta del informe `afuera_comunidad_mods.md` §4.
 *
 * Uso: node tools/vista_chat/mockups.mjs [--salida <carpeta>]   (por defecto exports/explicaciones/mockups_chat)
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

// Colores de claude-skins, copiados de su código (17/10/2026). `palette` = variante oscura, `light` = clara.
// nord y mono traen solo la oscura.
export const SKINS = {
  github: {
    oscuro: { user: '#58a6ff', fg: '#e6edf3', muted: '#7d8590', surface: '#161b22', zebra: '#11161d', read: '#79c0ff', run: '#d29922', write: '#ffa657', ok: '#3fb950', err: '#f85149', warn: '#d29922' },
    claro: { user: '#0969da', fg: '#1f2328', muted: '#656d76', surface: '#f6f8fa', zebra: '#fafbfc', read: '#0969da', run: '#9a6700', write: '#bc4c00', ok: '#1a7f37', err: '#cf222e', warn: '#9a6700' },
  },
  solarized: {
    claro: { user: '#268bd2', fg: '#586e75', muted: '#93a1a1', surface: '#eee8d5', zebra: '#f5efdc', read: '#2aa198', run: '#b58900', write: '#cb4b16', ok: '#859900', err: '#dc322f', warn: '#b58900' },
  },
  nord: {
    oscuro: { user: '#88c0d0', fg: '#e5e9f0', muted: '#7b88a1', surface: '#3b4252', zebra: '#353b49', read: '#8fbcbb', run: '#ebcb8b', write: '#d08770', ok: '#a3be8c', err: '#bf616a', warn: '#ebcb8b' },
  },
  'tokyo-night': {
    oscuro: { user: '#7aa2f7', fg: '#c0caf5', muted: '#737aa2', surface: '#1f2335', zebra: '#1d2030', read: '#7dcfff', run: '#e0af68', write: '#ff9e64', ok: '#9ece6a', err: '#f7768e', warn: '#e0af68' },
  },
  mono: {
    oscuro: { user: '#e0e0e0', fg: '#e0e0e0', muted: '#7a7a7a', surface: '#262626', zebra: '#222222', read: '#9e9e9e', run: '#bdbdbd', write: '#e0e0e0', ok: '#e0e0e0', err: '#ffffff', warn: '#bdbdbd' },
  },
};

const S = SKINS;
// Cada maqueta: los colores que usa y de dónde sale cada uno (`fuente`), para que el HTML lo diga.
export const MAQUETAS = [
  {
    clave: 'papel', nombre: 'Papel', tipo: 'claro, fondo hueso',
    idea: 'Parecido a una hoja impresa: para leer mucho rato. Es lo contrario del oscuro de hoy.',
    c: {
      fondo: '#f7f4ec', lateral: '#efebe0', texto: S.github.claro.fg, suave: S.github.claro.muted,
      cajaFak: S.solarized.claro.surface, cajaCodigo: '#efebe0', borde: '#ddd6c4', acento: '#1f4e79',
      fila: S.solarized.claro.zebra, leer: S.github.claro.read, correr: S.github.claro.run, escribir: S.github.claro.write,
      ok: S.github.claro.ok, err: S.github.claro.err, warn: S.github.claro.warn,
    },
    fuente: 'Tema CLARO de la app + skin «github» (texto, íconos y semáforo, variante clara) con las cajas del skin «solarized» claro (#eee8d5). El fondo hueso #f7f4ec y el azul #1f4e79 son la propuesta del informe de la comunidad del 15/10 (afuera_comunidad_mods.md, en la nube de Ingeniería): ningún skin pinta el fondo de la ventana.',
    probar: '/skin github  (o /skin solarized) con la app en tema claro',
  },
  {
    clave: 'azul-noche', nombre: 'Azul noche', tipo: 'oscuro suave, sin marrón',
    idea: 'Sigue siendo oscuro, pero azul y no negro-marrón: cansa menos a la noche.',
    c: {
      fondo: '#16222e', lateral: '#121c26', texto: S.nord.oscuro.fg, suave: '#9fb3c8',
      cajaFak: '#22364a', cajaCodigo: S['tokyo-night'].oscuro.surface, borde: S.nord.oscuro.surface, acento: '#f2c14e',
      fila: S['tokyo-night'].oscuro.zebra, leer: S.nord.oscuro.read, correr: S.nord.oscuro.run, escribir: S.nord.oscuro.write,
      ok: S.nord.oscuro.ok, err: S.nord.oscuro.err, warn: S.nord.oscuro.warn,
    },
    fuente: 'Tema OSCURO de la app + skin «nord» (texto, íconos y semáforo) con el código en las cajas de «tokyo-night» (#1f2335). El fondo #16222e, el gris secundario #9fb3c8, la caja de Fak #22364a y el ámbar #f2c14e son la propuesta del informe de la comunidad del 15/10.',
    probar: '/skin nord  (o /skin tokyo-night) con la app en tema oscuro',
  },
  {
    clave: 'plano-de-planta', nombre: 'Plano de planta', tipo: 'gris claro con semáforo',
    idea: 'Gris de plano, sin colores de adorno: verde = hecho, ámbar = ojo, rojo = error. Sale bien en una captura para un informe.',
    c: {
      fondo: '#eceff1', lateral: '#e1e5e8', texto: '#111827', suave: '#4b5563',
      cajaFak: '#dde2e6', cajaCodigo: '#e4e8eb', borde: '#c7cdd2', acento: '#111827',
      fila: '#f3f5f6', leer: '#4b5563', correr: '#4b5563', escribir: '#4b5563',
      ok: S.github.claro.ok, err: S.github.claro.err, warn: S.github.claro.warn,
    },
    fuente: 'La idea del skin «mono» (solo grises) llevada a claro: «mono» trae únicamente variante oscura. El fondo #eceff1 y el texto #111827 son la propuesta del informe de la comunidad del 15/10; los demás grises son una elección de esta maqueta. El semáforo sale del skin «github» claro (#1a7f37, #9a6700, #cf222e).',
    probar: '/skin mono  (no se verificó cómo se ve en tema claro: trae solo la variante oscura)',
  },
];

// La de hoy, reconstruida con los colores medidos en la ventana de la app el 17/10/2026 (fondo del chat #151515,
// barra lateral #111111, cajas #212121). El texto y el resto son aproximados: es una RECONSTRUCCIÓN, no una captura.
export const HOY = {
  clave: 'hoy', nombre: 'Hoy', tipo: 'oscuro de la app (reconstrucción)',
  c: {
    fondo: '#151515', lateral: '#111111', texto: '#e8e6e3', suave: '#9a9893', cajaFak: '#212121', cajaCodigo: '#1c1c1c',
    borde: '#2a2a2a', acento: '#d97757', fila: '#1a1a1a', leer: '#9a9893', correr: '#9a9893', escribir: '#9a9893',
    ok: '#7fb069', err: '#e5534b', warn: '#d9a441',
  },
};

/** Contraste WCAG entre dos colores #rrggbb (1 a 21). */
export function contraste(a, b) {
  const lum = (hex) => {
    const n = hex.replace('#', '');
    const [r, g, bb] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bb;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const coma = (n) => n.toFixed(1).replace('.', ',');

/** Los pares que importan para leer, con su contraste. */
export function contrastes(c) {
  return [
    ['texto sobre el fondo', contraste(c.texto, c.fondo)],
    ['texto dentro de tu mensaje', contraste(c.texto, c.cajaFak)],
    ['texto gris (secundario)', contraste(c.suave, c.fondo)],
    ['verde «hecho»', contraste(c.ok, c.fondo)],
    ['ámbar «ojo»', contraste(c.warn, c.fondo)],
    ['rojo «error»', contraste(c.err, c.fondo)],
  ];
}

/** La conversación de ejemplo (texto inventado) pintada con una paleta. */
export function htmlMaqueta(m) {
  const c = m.c;
  const fila = (color, que, detalle) => `<div class="fila"><span class="punto" style="background:${color}"></span><b>${que}</b> <span class="suave">${detalle}</span></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{width:1200px;height:760px;font-family:"Segoe UI",system-ui,sans-serif;font-size:15px;background:${c.fondo};color:${c.texto};display:flex}
  .lat{width:250px;background:${c.lateral};border-right:1px solid ${c.borde};padding:18px 14px;display:flex;flex-direction:column;gap:9px}
  .lat .t{font-size:12px;color:${c.suave};margin-top:10px}
  .lat .s{padding:6px 8px;border-radius:6px;font-size:14px}
  .lat .s.act{background:${c.cajaFak}}
  .main{flex:1;display:flex;flex-direction:column;padding:22px 60px 18px}
  .cab{font-weight:600;margin-bottom:18px;color:${c.texto}}
  .fak{align-self:flex-end;max-width:70%;background:${c.cajaFak};border-radius:12px;padding:10px 14px;margin-bottom:16px}
  .resp{max-width:88%;line-height:1.5}
  .resp p{margin-bottom:10px}
  .resp b.ac{color:${c.acento}}
  .fila{display:flex;align-items:center;gap:8px;font-size:13.5px;padding:5px 10px;border-radius:6px;background:${c.fila};margin-bottom:5px;border:1px solid ${c.borde}}
  .punto{width:9px;height:9px;border-radius:50%;display:inline-block}
  .suave{color:${c.suave}}
  table{border-collapse:collapse;margin:10px 0 12px;font-size:14px}
  th,td{padding:5px 12px;border-bottom:1px solid ${c.borde};text-align:left}
  th{color:${c.suave};font-weight:600}
  tr:nth-child(even) td{background:${c.fila}}
  .ok{color:${c.ok};font-weight:600}.warn{color:${c.warn};font-weight:600}.err{color:${c.err};font-weight:600}
  code{background:${c.cajaCodigo};border:1px solid ${c.borde};border-radius:4px;padding:1px 6px;font-family:Consolas,monospace;font-size:13px}
  .banda{margin-top:auto;border:1px solid ${c.borde};border-radius:10px;padding:8px 12px;font-size:12.5px;color:${c.suave};background:${c.cajaCodigo}}
  .banda b{color:${c.texto}}
  .caja{margin-top:10px;border:1px solid ${c.borde};border-radius:12px;padding:12px 14px;color:${c.suave};background:${c.fondo}}
  .etq{position:absolute;right:14px;top:10px;font-size:12px;color:${c.suave}}
  </style></head><body>
  <div class="lat"><div class="s">+ Nuevo</div><div class="t">BarackMercosul</div>
    <div class="s act">Hoja de costura del armrest</div><div class="s">Consumo del vinilo</div><div class="s">Flujograma 160</div><div class="s">Impresora: pieza nueva</div></div>
  <div class="main"><div class="cab">Hoja de costura del armrest</div>
    <div class="fak">¿Cómo quedó la hoja? Pasame qué falta antes de imprimirla</div>
    <div class="resp">
      ${fila(c.leer, 'Leer', 'hoja_costura.pptx')}${fila(c.correr, 'Correr', 'chequeo de la hoja')}${fila(c.escribir, 'Editar', 'paso 3: foto nueva')}
      <p style="margin-top:10px"><b class="ac">La hoja está lista para imprimir</b>, salvo un dato que tenés que confirmar vos.</p>
      <table><tr><th>Control</th><th>Resultado</th></tr>
        <tr><td>Fotos de cada paso</td><td class="ok">✓ hecho</td></tr>
        <tr><td>Número de hoja</td><td class="warn">● ojo: falta el número</td></tr>
        <tr><td>Hoja impresa sin cortes</td><td class="ok">✓ hecho</td></tr>
        <tr><td>Logo oficial</td><td class="err">✕ error: era otro logo</td></tr></table>
      <p>El chequeo se corre con <code>hoja_proceso_check.py</code> y da verde.</p>
    </div>
    <div class="banda">cupo 5 h <b>9 %</b> · semana <b>43 %</b> &nbsp;·&nbsp; agentes corren <b>0</b> &nbsp;·&nbsp; noche <b>06:30</b></div>
    <div class="caja">Escribe / para comandos</div>
  </div></body></html>`;
}

export function htmlIndice(maquetas) {
  const tarjeta = (m) => {
    const filas = contrastes(m.c).map(([que, v]) => `<tr><td>${que}</td><td class="${v >= 4.5 ? 'bien' : 'mal'}">${coma(v)}</td></tr>`).join('');
    return `<section class="t"><h2>${m.nombre} <span>· ${m.tipo}</span></h2>
      <a href="${m.clave}.png"><img src="${m.clave}.png" alt="Maqueta ${m.nombre}"></a>
      <p>${m.idea}</p><p class="f"><b>De dónde salen los colores:</b> ${m.fuente}</p>
      <p class="f"><b>Para probarlo en vivo</b> (después de instalar el skin, con tu sí): <code>${m.probar}</code></p>
      <table><tr><th>Contraste (mínimo 4,5)</th><th></th></tr>${filas}</table>${contrastes(m.c).some(([, v]) => v < 4.5) ? '<p class="f">Lo que sale en rojo queda apenas debajo del mínimo para letra chica: en negrita se lee, pero si elegís esta opción ese color se ajusta un tono antes de usarla.</p>' : ''}</section>`;
  };
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Colores del chat</title><style>
:root{--fondo:#f7f7f5;--texto:#1f2328;--suave:#57606a;--borde:#d0d7de;--tarjeta:#fff}
@media (prefers-color-scheme:dark){:root{--fondo:#16181b;--texto:#e6edf3;--suave:#9aa4ae;--borde:#30363d;--tarjeta:#1d2125}}
body{margin:0;background:var(--fondo);color:var(--texto);font-family:"Segoe UI",system-ui,sans-serif;line-height:1.5}
main{max-width:1500px;margin:0 auto;padding:24px 16px}
h1{font-size:26px;margin:0 0 6px}h2{font-size:20px;margin:0 0 10px}h2 span{color:var(--suave);font-weight:400;font-size:16px}
.aviso{background:var(--tarjeta);border:1px solid var(--borde);border-left:5px solid #1f4e79;border-radius:8px;padding:12px 16px;margin:14px 0 22px}
.grilla{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:18px}
.t{background:var(--tarjeta);border:1px solid var(--borde);border-radius:10px;padding:14px}
.t img{width:100%;border:1px solid var(--borde);border-radius:6px}
.f{font-size:14px;color:var(--suave)}
table{border-collapse:collapse;font-size:14px}td,th{padding:3px 10px;border-bottom:1px solid var(--borde);text-align:left}
.bien{color:#1a7f37;font-weight:600}.mal{color:#cf222e;font-weight:600}
code{font-family:Consolas,monospace;background:var(--fondo);padding:1px 5px;border-radius:4px}
.hoy{display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap}.hoy img{width:420px;max-width:100%;border:1px solid var(--borde);border-radius:6px}
@media (max-width:480px){.grilla{grid-template-columns:1fr}}
</style></head><body><main>
<h1>Cómo se vería el chat: tres opciones para elegir</h1>
<p>Son maquetas, no capturas: la conversación es de ejemplo y no se instaló nada. Elegí una, o ninguna.</p>
<div class="aviso"><b>Lo oficial para «es muy oscuro» es pasar la app a tema claro.</b> Mirá en Configuración si aparece
«Apariencia» o «Tema» (y si hay tamaño de letra), y escribí <code>/theme</code> en una conversación para ver si la app
lo acepta. No lo pude ver desde acá: para sacar una captura del tema claro había que cambiarte la configuración.
Un skin (un mod de la comunidad) repinta los mensajes, las tablas y las filas de herramientas; el fondo de la ventana
lo pone la app y <b>la letra no la cambia ningún mod</b>.</div>
<div class="grilla">${maquetas.map(tarjeta).join('')}</div>
<h2 style="margin-top:26px">Para comparar: así es hoy</h2>
<div class="hoy"><img src="hoy.png" alt="Reconstrucción del tema oscuro de hoy"><p class="f">Reconstrucción con los colores
medidos en la ventana de la app el 17/10/2026 (fondo del chat #151515, barra lateral #111111, cajas #212121). No es una
captura: la conversación es la misma de ejemplo.</p></div>
</main></body></html>`;
}

async function main() {
  const i = process.argv.indexOf('--salida');
  const salida = path.resolve(i > 0 ? process.argv[i + 1] : 'exports/explicaciones/mockups_chat');
  fs.mkdirSync(salida, { recursive: true });
  const nav = await chromium.launch();
  try {
    const pag = await nav.newPage({ viewport: { width: 1200, height: 760 } });
    for (const m of [...MAQUETAS, HOY]) {
      await pag.setContent(htmlMaqueta(m), { waitUntil: 'load' });
      await pag.screenshot({ path: path.join(salida, `${m.clave}.png`) });
    }
  } finally { await nav.close(); }
  fs.writeFileSync(path.join(salida, 'index.html'), htmlIndice(MAQUETAS), 'utf8');
  console.log(`listo: ${salida}\\index.html (${MAQUETAS.length} maquetas + la de hoy)`);
}

if (process.argv[1] && /mockups\.mjs$/.test(process.argv[1])) await main();
