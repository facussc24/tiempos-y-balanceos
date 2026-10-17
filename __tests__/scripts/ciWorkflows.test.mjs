/**
 * ciWorkflows.test.mjs — la particion del CI de la tanda 9 (pieza 9) no filtra el candado del repo publico.
 * Sin push no hay prueba en vivo: este test es el caso que tiene que frenar. Lee el YAML como texto (no hay un parser
 * de YAML en las dependencias y no se agrega uno por esto).
 */
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(__dirname, '..', '..');
const leer = (f) => fs.readFileSync(path.join(RAIZ, '.github', 'workflows', f), 'utf8');
/** El bloque `on:` de un workflow (hasta el proximo bloque de primer nivel). */
const bloqueOn = (t) => (t.match(/^on:\n([\s\S]*?)(?=^\S)/m) || [, ''])[1];

describe('candado.yml corre siempre', () => {
  const t = leer('candado.yml');
  it('ROJO si el candado gana un filtro de rutas (paths, paths-ignore) o deja de correr en main', () => {
    const on = bloqueOn(t);
    expect(on).toMatch(/push:\s*\n\s+branches: \[main\]/);
    expect(on).not.toMatch(/paths/);
  });
  it('trae los dos pasos de _gateRepoPublico.mjs (selftest y gate) y los gates de tipos, pruebas y lint', () => {
    expect(t).toMatch(/run: node scripts\/_gateRepoPublico\.mjs --selftest/);
    expect(t).toMatch(/run: node scripts\/_gateRepoPublico\.mjs\s*$/m);
    for (const job of ['repo-publico:', 'typecheck:', 'test:', 'lint:']) expect(t).toContain(`\n  ${job}`);
    expect(t).not.toMatch(/deploy-pages|upload-pages-artifact/);
  });
});

describe('deploy.yml corre solo cuando cambia la app, y sigue con su propio candado', () => {
  const t = leer('deploy.yml');
  it('filtra por las carpetas que entran al build (medidas con el grafo de imports desde index.tsx)', () => {
    const on = bloqueOn(t);
    for (const p of ['modules/**', 'components/**', 'core/**', 'hooks/**', 'src/**', 'types/**', 'utils/**', 'public/**', '*.ts', '*.tsx', 'index.*', 'package.json', 'package-lock.json']) {
      expect(on, p).toContain(`'${p}'`);
    }
    expect(on).toMatch(/workflow_dispatch/);
    expect(on).not.toMatch(/'scripts\/\*\*'/);
  });
  it('el deploy espera al candado, los tipos, las pruebas y el lint, y ninguno de ellos pierde el candado', () => {
    expect(t).toMatch(/needs: \[repo-publico, typecheck, test, lint\]/);
    expect(t).toMatch(/run: node scripts\/_gateRepoPublico\.mjs --selftest/);
    expect(t).toMatch(/run: node scripts\/_gateRepoPublico\.mjs\s*$/m);
  });
  it('las variables de dev-login siguen afuera del build publicado', () => {
    expect(t).not.toMatch(/VITE_AUTO_LOGIN_(EMAIL|PASSWORD):/);
  });
});
