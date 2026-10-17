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

/** El bloque de un job (desde `  <job>:` hasta el proximo job de primer nivel o el final). */
const bloqueJob = (t, job) => (t.match(new RegExp(`^  ${job}:\\n([\\s\\S]*?)(?=^  [a-z][a-z0-9-]*:\\n|(?![\\s\\S]))`, 'm')) || [, ''])[1];

describe('el job lint del candado no se rompe con los guiones de Workflow (ronda 2, auditor)', () => {
  it('ESLint ignora .claude/workflows/ (un guion de Workflow tiene un return de nivel superior)', async () => {
    const { ESLint } = await import('eslint');
    const eslint = new ESLint({ cwd: RAIZ });
    expect(await eslint.isPathIgnored(path.join(RAIZ, '.claude', 'workflows', 'revision-adversarial.js'))).toBe(true);
    expect(await eslint.isPathIgnored(path.join(RAIZ, 'scripts', '_cierreSesion.mjs'))).toBe(false);
  }, 60000);
});

describe('el job del candado no se puede saltear (ronda 2, detalle 2)', () => {
  for (const f of ['candado.yml', 'deploy.yml']) {
    it(`ROJO en ${f} si el job repo-publico gana un \`if:\` o un paso del gate gana continue-on-error`, () => {
      const job = bloqueJob(leer(f), 'repo-publico');
      expect(job, f).toMatch(/_gateRepoPublico\.mjs/);
      expect(job, f).not.toMatch(/^\s+if:/m);
      expect(job, f).not.toMatch(/continue-on-error/);
    });
  }
  it('el lector de bloques encuentra el job (si no, el test de arriba pasaria vacio)', () => {
    expect(bloqueJob('jobs:\n  repo-publico:\n    if: false\n  otro:\n    x: 1\n', 'repo-publico')).toMatch(/if: false/);
  });
});

describe('deploy.yml corre solo cuando cambia la app, y sigue con su propio candado', () => {
  const t = leer('deploy.yml');
  it('filtra por las carpetas que entran al build (medidas con el grafo de imports desde index.tsx)', () => {
    const on = bloqueOn(t);
    for (const p of ['modules/**', 'components/**', 'core/**', 'hooks/**', 'src/**', 'types/**', 'utils/**', 'public/**', '*.ts', '*.tsx', 'index.*', 'package.json', 'package-lock.json',
      'vite.config.*', 'tailwind.config.*', 'postcss.config.*', 'tsconfig*.json', '.github/workflows/deploy.yml']) {   // las 18 (ronda 2, detalle 4)
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
