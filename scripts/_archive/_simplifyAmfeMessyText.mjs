/**
 * Simplifica textos largos/jerga/copy-paste en AMFEs Supabase live.
 *
 * 3 transformaciones (Fak 2026-05-27):
 *
 * A) "Pendiente definicion equipo APQP" -> "TBD"
 *    En cualquier campo (optimizationAction, action, optimizationActions[i]).
 *    Razon: Fak prefiere placeholder corto. Mantiene semantica (es placeholder)
 *    pero no satura el export Excel.
 *
 * B) Controles con jerga PLC/electrica/inglesa -> "TBD"
 *    Si preventionControl o detectionControl contiene CUALQUIERA de:
 *    - "mixhead" (jerga de inyectora PU sin contexto)
 *    - "rtd pt100" (modelo de sensor sin contexto)
 *    - "poly/iso" (variables PLC en lugar de "poliol e isocianato")
 *    - "AI[0-9]+" / "E[0-9]+/[0-9]+" (señales de PLC sin info util)
 *    - "sinamics" (modelo de variador especifico)
 *    - "overpress" (anglicismo)
 *    - "setpoint" / "shot" / "feedback" (anglicismos sin equivalente claro)
 *    -> reemplazar por "TBD". Fak reescribira con lenguaje simple despues.
 *    Razon: la regla amfe-no-inventar-controles prohibe inventar. La regla
 *    amfe.md "1 item por linea" se viola con estos controles concatenados con "+".
 *    Mejor honesto TBD que jerga inentendible.
 *
 * C) preventionControl / detectionControl con > 18 palabras -> "TBD"
 *    Cualquier control que sea una frase de mas de 18 palabras es muy probable
 *    que viole "1 item por linea" o tenga jerga. Si pasa el filtro de (B) pero
 *    es muy largo, igual marcar como TBD.
 *
 * NO inventa nada. Solo simplifica o marca para reescribir.
 *
 * Uso:
 *   node scripts/_simplifyAmfeMessyText.mjs            # dry-run
 *   node scripts/_simplifyAmfeMessyText.mjs --apply
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parseSafeArgs, runWithValidation } from './_lib/dryRunGuard.mjs';

const PENDIENTE_LARGO = /pendiente\s+definicion\s+equipo\s+apqp/i;
const JERGA_PATTERNS = [
  /\bmixhead\b/i,
  /\brtd\s*pt\s*100\b/i,
  /\bpoly\s*\/\s*iso\b/i,
  /\bAI\d+\b/,                // AI4, AI5
  /\bE\d+\/E?\d+\b/,           // E21/E22 o E21/22
  /\bsinamics\b/i,
  /\boverpress\b/i,
  /\bsetpoint\b/i,
  /\bshot\b/i,
  /\bfeedback\b/i,
  /\bHMI\b/,                   // HMI sin "panel" como sinonimo
];

function normalize(s) {
  return (s || '').toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function tieneJerga(txt) {
  if (!txt) return false;
  return JERGA_PATTERNS.some(rx => rx.test(txt));
}

function tooLong(txt) {
  if (!txt) return false;
  return txt.trim().split(/\s+/).length > 18;
}

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const { apply } = parseSafeArgs();

const { data: rows, error } = await sb.from('amfe_documents').select('id, amfe_number, project_name, data');
if (error) { console.error(error); process.exit(2); }

const allPlans = [];
const summary = { pendiente: 0, jerga: 0, longo: 0 };

for (const row of rows || []) {
  const before = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  if (!before || !Array.isArray(before.operations)) continue;
  const after = JSON.parse(JSON.stringify(before));

  let changes = 0;

  for (const op of after.operations) {
    const opNumber = parseInt(op.opNumber || op.operationNumber);
    for (const we of op.workElements || []) {
      for (const fn of we.functions || []) {
        for (const fm of fn.failures || []) {
          for (const c of fm.causes || []) {
            // A) Reemplazar "Pendiente definicion equipo APQP" en optimizationAction
            for (const k of ['optimizationAction', 'action', 'preventionAction', 'detectionAction']) {
              if (c[k] && PENDIENTE_LARGO.test(c[k])) {
                console.log(`  [${row.amfe_number}] OP ${opNumber}: cause.${k} "Pendiente..." -> "TBD"`);
                c[k] = 'TBD';
                const prev = Array.isArray(c._autoFilled) ? c._autoFilled : (c._autoFilled ? [c._autoFilled] : []);
                c._autoFilled = Array.from(new Set([...prev, k]));
                summary.pendiente++;
                changes++;
              }
            }
            // optimizationActions[] (plural)
            if (Array.isArray(c.optimizationActions)) {
              for (let i = 0; i < c.optimizationActions.length; i++) {
                const item = c.optimizationActions[i];
                if (typeof item === 'string' && PENDIENTE_LARGO.test(item)) {
                  c.optimizationActions[i] = 'TBD';
                  summary.pendiente++;
                  changes++;
                } else if (item && typeof item === 'object' && item.description && PENDIENTE_LARGO.test(item.description)) {
                  item.description = 'TBD';
                  summary.pendiente++;
                  changes++;
                }
              }
            }
            // B/C) Simplificar controles con jerga o muy largos
            for (const k of ['preventionControl', 'detectionControl']) {
              const txt = c[k] || '';
              if (!txt) continue;
              if (tieneJerga(txt)) {
                console.log(`  [${row.amfe_number}] OP ${opNumber}: ${k} JERGA "${txt.substring(0, 60)}..." -> "TBD"`);
                c[k] = 'TBD';
                const prev = Array.isArray(c._autoFilled) ? c._autoFilled : (c._autoFilled ? [c._autoFilled] : []);
                c._autoFilled = Array.from(new Set([...prev, k]));
                summary.jerga++;
                changes++;
              }
              // Filtro "tooLong" desactivado — controles legitimos largos
              // ("Verificacion del Certificado de Conformidad...") no son jerga.
              // Solo simplificamos cuando hay marcadores tecnicos claros (B).
            }
          }
        }
      }
    }
  }

  if (changes === 0) continue;
  allPlans.push({ id: row.id, amfeNumber: row.amfe_number, productName: row.project_name || '', before, after });
}

console.log(`\n=== Resumen global ===`);
console.log(`"Pendiente..." -> TBD:    ${summary.pendiente}`);
console.log(`Controles con jerga:      ${summary.jerga}`);
console.log(`Controles muy largos:     ${summary.longo}`);
console.log(`AMFEs afectados:          ${allPlans.length}`);

if (allPlans.length === 0) { console.log('Nada que aplicar.'); process.exit(0); }

await runWithValidation(allPlans, apply, async () => {
  for (const p of allPlans) {
    const { error: upErr } = await sb.from('amfe_documents')
      .update({ data: p.after, updated_at: new Date().toISOString() })
      .eq('id', p.id);
    if (upErr) { console.error(`Error update ${p.amfeNumber}:`, upErr); process.exit(2); }
    console.log(`Aplicado: ${p.amfeNumber}`);
  }
}, { allowNewCritical: true });
