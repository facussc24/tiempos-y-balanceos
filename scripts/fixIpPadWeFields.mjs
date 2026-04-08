/**
 * fixIpPadWeFields.mjs
 * Fixes WE field names: description → name + type for new WEs created with wrong schema.
 * Also adds missing 'requirements' field to functions.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const DRY_RUN = process.argv.indexOf('--apply') < 0;
const ENV_PATH = 'C:/Users/FacundoS-PC/dev/BarackMercosul/.env.local';
const IPPAD_ID = 'c9b93b84-f804-4cd0-91c1-c4878db41b97';

const envText = readFileSync(ENV_PATH, 'utf8');
const env = Object.fromEntries(
  envText.split('\n')
    .filter(function(l){return l.includes('=') && l.charAt(0) !== '#';})
    .map(function(l){ var i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

// Map description prefix → type
function parseWeType(desc) {
  if (!desc) return { name: '', type: 'Man' };
  var lower = desc.toLowerCase();
  if (lower.indexOf('maquina:') === 0 || lower.indexOf('máquina:') === 0) {
    return { name: desc.split(':').slice(1).join(':').trim(), type: 'Machine' };
  }
  if (lower.indexOf('mano de obra:') === 0) {
    return { name: desc.split(':').slice(1).join(':').trim(), type: 'Man' };
  }
  if (lower.indexOf('metodo:') === 0 || lower.indexOf('método:') === 0) {
    return { name: desc.split(':').slice(1).join(':').trim(), type: 'Method' };
  }
  if (lower.indexOf('material:') === 0) {
    return { name: desc.split(':').slice(1).join(':').trim(), type: 'Material' };
  }
  if (lower.indexOf('medicion:') === 0 || lower.indexOf('medición:') === 0) {
    return { name: desc.split(':').slice(1).join(':').trim(), type: 'Measurement' };
  }
  if (lower.indexOf('medio ambiente:') === 0) {
    return { name: desc.split(':').slice(1).join(':').trim(), type: 'Environment' };
  }
  return { name: desc, type: 'Method' };
}

async function main() {
  var authRes = await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });
  if (authRes.error) { console.error('Auth failed:', authRes.error.message); process.exit(1); }

  var res = await sb.from('amfe_documents').select('*').eq('id', IPPAD_ID).single();
  var d = res.data.data;
  if (typeof d === 'string') try { d = JSON.parse(d); } catch(e) {}

  var fixes = 0;

  (d.operations || []).forEach(function(op) {
    (op.workElements || []).forEach(function(we) {
      // Fix WEs that have 'description' but no 'name'
      if ('description' in we && !('name' in we)) {
        var parsed = parseWeType(we.description);
        we.name = parsed.name;
        we.type = parsed.type;
        delete we.description;
        fixes++;
        console.log('FIX OP', op.operationNumber, '| name:', we.name, '| type:', we.type);
      }

      // Ensure all functions have 'requirements' field
      (we.functions || []).forEach(function(fn) {
        if (!('requirements' in fn)) {
          fn.requirements = '';
        }
      });
    });
  });

  console.log('\nTotal WE fixes:', fixes);
  console.log('Mode:', DRY_RUN ? 'DRY-RUN' : 'APPLY');

  if (DRY_RUN) { console.log('\nDry-run complete.'); process.exit(0); }

  var writeRes = await sb.from('amfe_documents').update({ data: d }).eq('id', IPPAD_ID);
  if (writeRes.error) { console.error('Write failed:', writeRes.error.message); process.exit(1); }
  console.log('Written to Supabase');

  // Verify
  var vRes = await sb.from('amfe_documents').select('data').eq('id', IPPAD_ID).single();
  var vd = vRes.data.data;
  if (typeof vd === 'string') try { vd = JSON.parse(vd); } catch(e) {}
  var broken = 0;
  (vd.operations || []).forEach(function(op) {
    (op.workElements || []).forEach(function(we) {
      if ('description' in we && !('name' in we)) broken++;
    });
  });
  console.log('Verification: broken WEs remaining:', broken, broken === 0 ? 'OK' : 'FAIL');
}

main().catch(function(e) { console.error(e); process.exit(1); });
