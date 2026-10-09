/**
 * _vigilarPrecios.mjs — el vigilante semanal de precios, creditos y retiro de modelos de Anthropic.
 *
 * Baja tres paginas oficiales (pricing, creditos del plan, deprecaciones), compara los 4 modelos que
 * usamos contra `PRECIOS` de scripts/_lib/claudeApi.mjs y avisa si algo cambio. No usa ningun modelo y no
 * gasta creditos. Lo llama la noche una vez por semana (`import { correr }`); a mano sirve para mirar.
 *
 * Uso:
 *   node scripts/_vigilarPrecios.mjs                     baja las paginas y muestra la tabla
 *   node scripts/_vigilarPrecios.mjs --simular           usa las paginas guardadas en __tests__/fixtures/precios
 *   node scripts/_vigilarPrecios.mjs --json              imprime el resultado como JSON (sin la tabla)
 *   node scripts/_guardarFixturesPrecios.mjs            baja y guarda las paginas como fixtures (script aparte: escribe en el repo)
 *   node scripts/_vigilarPrecios.mjs --sin-guardar       no escribe el JSON de la corrida
 *
 * Deja el JSON en .sgc-cache/api/precios/AAAA-MM-DD.json (fuera de git). Sale con:
 *   0  todo igual
 *   3  hay diferencias de precio o de creditos, o un modelo nuestro con fecha de retiro
 *   1  no se pudo bajar o no se entendio una pagina (NO es "sin diferencias"), o un argumento que no conozco
 * Si hay diferencias en una pagina y otra no se pudo leer, sale con 3 y el error se imprime igual.
 * Detalle del diseno y por que lee markdown: encabezado de scripts/_lib/vigilarPrecios.mjs.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  correr, bajarPaginas, formatearResultado,
} from './_lib/vigilarPrecios.mjs';

const USO = [
  'Uso: node scripts/_vigilarPrecios.mjs [--simular] [--json] [--sin-guardar]',
  '  --simular          usa las paginas guardadas (__tests__/fixtures/precios) en vez de bajar',
  '  (las paginas guardadas las baja node scripts/_guardarFixturesPrecios.mjs, un script aparte que escribe en el repo)',
  '  --json             imprime el resultado como JSON',
  '  --sin-guardar      no escribe el JSON de la corrida',
].join('\n');

const BANDERAS = new Set(['--simular', '--json', '--sin-guardar', '--ayuda', '-h']);

export async function main(args) {
  const raros = args.filter((a) => !BANDERAS.has(a));
  if (raros.length) { console.error(`Argumento que no conozco: ${raros.join(' ')}. No hago nada.\n${USO}`); return 1; }
  if (args.includes('--ayuda') || args.includes('-h')) { console.log(USO); return 0; }
  const simular = args.includes('--simular');

  try {
    const paginas = simular ? undefined : await bajarPaginas();
    const r = await correr({ simular, paginas, guardar: !args.includes('--sin-guardar') });

    console.log(args.includes('--json') ? JSON.stringify(r, null, 2) : formatearResultado(r));
    return r.codigo;
  } catch (e) {
    console.error(`Fallo: ${e?.message ?? e}`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}
