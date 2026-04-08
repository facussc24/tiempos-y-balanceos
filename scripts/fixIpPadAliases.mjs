/**
 * fixIpPadAliases.mjs
 * Adds missing field aliases that the AMFE Excel export expects.
 * The export uses opNumber/name but scripts stored operationNumber/operationName.
 * Also fixes cause.ap alias from cause.actionPriority, and cause.cause from cause.description.
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

async function main() {
  var authRes = await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });
  if (authRes.error) { console.error('Auth failed:', authRes.error.message); process.exit(1); }

  var res = await sb.from('amfe_documents').select('*').eq('id', IPPAD_ID).single();
  var d = res.data.data;
  if (typeof d === 'string') try { d = JSON.parse(d); } catch(e) {}

  var opFixes = 0;
  var causeFixes = 0;
  var fnFixes = 0;

  (d.operations || []).forEach(function(op) {
    // Operation-level: FORCE sync (operationNumber is source of truth)
    if (op.operationNumber) {
      if (op.opNumber !== op.operationNumber) { op.opNumber = op.operationNumber; opFixes++; }
    } else if (op.opNumber) { op.operationNumber = op.opNumber; }
    if (op.operationName) {
      if (op.name !== op.operationName) { op.name = op.operationName; opFixes++; }
    } else if (op.name) { op.operationName = op.name; }

    (op.workElements || []).forEach(function(we) {
      (we.functions || []).forEach(function(fn) {
        // Function-level: ensure both description and functionDescription exist
        if (fn.description && fn.functionDescription === undefined) {
          fn.functionDescription = fn.description;
          fnFixes++;
        }
        if (fn.functionDescription && fn.description === undefined) {
          fn.description = fn.functionDescription;
          fnFixes++;
        }
        // Ensure requirements exists
        if (fn.requirements === undefined) {
          fn.requirements = '';
        }

        (fn.failures || []).forEach(function(fail) {
          (fail.causes || []).forEach(function(c) {
            // Cause aliases: ap <-> actionPriority
            if (c.actionPriority && (c.ap === undefined || c.ap === '')) {
              c.ap = c.actionPriority;
              causeFixes++;
            }
            if (c.ap && (c.actionPriority === undefined || c.actionPriority === '')) {
              c.actionPriority = c.ap;
            }
            // Cause aliases: cause <-> description (cause text)
            if (c.description && (c.cause === undefined || c.cause === '')) {
              c.cause = c.description;
              causeFixes++;
            }
            if (c.cause && (c.description === undefined || c.description === '')) {
              c.description = c.cause;
            }
            // Ensure all export-expected fields exist
            if (c.specialChar === undefined) c.specialChar = '';
            if (c.characteristicNumber === undefined) c.characteristicNumber = '';
            if (c.filterCode === undefined) c.filterCode = '';
            if (c.preventionAction === undefined) c.preventionAction = '';
            if (c.detectionAction === undefined) c.detectionAction = '';
            if (c.responsible === undefined) c.responsible = '';
            if (c.targetDate === undefined) c.targetDate = '';
            if (c.status === undefined) c.status = '';
            if (c.actionTaken === undefined) c.actionTaken = '';
            if (c.completionDate === undefined) c.completionDate = '';
            if (c.severityNew === undefined) c.severityNew = '';
            if (c.occurrenceNew === undefined) c.occurrenceNew = '';
            if (c.detectionNew === undefined) c.detectionNew = '';
            if (c.apNew === undefined) c.apNew = '';
            if (c.observations === undefined) c.observations = '';
          });
        });
      });
    });
  });

  console.log('Op aliases fixed:', opFixes);
  console.log('Function aliases fixed:', fnFixes);
  console.log('Cause aliases fixed:', causeFixes);

  // Verify all ops have both field names
  console.log('\nVerification:');
  (d.operations || []).forEach(function(op) {
    var ok = op.opNumber && op.name && op.operationNumber && op.operationName;
    console.log('  OP', op.opNumber, ':', op.name, ok ? 'OK' : 'BROKEN');
  });

  console.log('\nMode:', DRY_RUN ? 'DRY-RUN' : 'APPLY');
  if (DRY_RUN) { console.log('Done.'); process.exit(0); }

  var wr = await sb.from('amfe_documents').update({ data: d }).eq('id', IPPAD_ID);
  if (wr.error) { console.error('Write failed:', wr.error.message); process.exit(1); }
  console.log('Written to Supabase');

  // Verify no double-serialization
  var vr = await sb.from('amfe_documents').select('data').eq('id', IPPAD_ID).single();
  var vd = vr.data.data;
  if (typeof vd === 'string') try { vd = JSON.parse(vd); } catch(e) {}
  var firstOp = (vd.operations || [])[0];
  console.log('Post-write check: op[0].opNumber=', firstOp.opNumber, 'op[0].name=', firstOp.name);
  console.log('Double-serial:', typeof vd === 'string' ? 'BAD' : 'No');
}

main().catch(function(e) { console.error(e); process.exit(1); });
