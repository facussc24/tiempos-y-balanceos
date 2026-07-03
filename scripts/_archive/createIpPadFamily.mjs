/**
 * createIpPadFamily.mjs
 *
 * Paso 3 del plan breezy-leaping-backus: crear familia IP PAD Patagonia - Tapizado
 * + 3 productos (PL1 primary / PL2 / PL3) + vinculacion en product_family_members.
 *
 * Dry-run por default. --apply para ejecutar.
 */

import { parseSafeArgs, logChange, finish } from './_lib/dryRunGuard.mjs';
import { connectSupabase } from './_lib/amfeIo.mjs';

const { apply } = parseSafeArgs();

const FAMILY = {
  name: 'IP PAD Patagonia - Tapizado',
  description: 'Familia IP PAD versiones tapizadas PVC (PL1 Low, PL2/PL3 High). Cliente VWA, Proyecto Patagonia. AMFE id: c9b93b84-f804-4cd0-91c1-c4878db41b97. PL0 Workhorse queda fuera (proceso distinto, sin tapizado).',
  linea_code: 'VWA',
  linea_name: 'VWA / Patagonia',
  active: 1,
};

const PRODUCTS = [
  {
    codigo: '2HC.858.417.B FAM',
    descripcion: 'PLATE ASM-I/P CTR OTLT AIR [IP PAD - LOW VERSION] (PL1)',
    linea_code: 'VWA',
    linea_name: 'VWA / Patagonia',
    is_primary: 1,
    variant_label: 'PL1 Low',
  },
  {
    codigo: '2HC.858.417.C GKK',
    descripcion: 'PLATE ASM-I/P CTR OTLT AIR [IP PAD - HIGH VERSION] (PL2)',
    linea_code: 'VWA',
    linea_name: 'VWA / Patagonia',
    is_primary: 0,
    variant_label: 'PL2 High GKK',
  },
  {
    codigo: '2HC.858.417.C GKN',
    descripcion: 'PLATE ASM-I/P CTR OTLT AIR [IP PAD - HIGH VERSION] (PL3)',
    linea_code: 'VWA',
    linea_name: 'VWA / Patagonia',
    is_primary: 0,
    variant_label: 'PL3 High GKN',
  },
];

const sb = await connectSupabase();

// ── 1. Verificar que la familia no exista ya ──
const { data: existingFam } = await sb.from('product_families').select('*').eq('name', FAMILY.name);
let familyId;
if (existingFam && existingFam.length > 0) {
  familyId = existingFam[0].id;
  console.log(`Familia ya existe: id=${familyId}. Skip create.`);
} else {
  logChange(apply, `CREATE family "${FAMILY.name}"`, FAMILY);
  if (apply) {
    const { data: ins, error } = await sb.from('product_families').insert(FAMILY).select('*').single();
    if (error) { console.error('INSERT family error:', error); process.exit(1); }
    familyId = ins.id;
    console.log(`  -> created family id=${familyId}`);
  } else {
    familyId = '(dry-run id)';
  }
}

// ── 2. Verificar y crear productos ──
const productIds = {};
for (const p of PRODUCTS) {
  const { data: existing } = await sb.from('products').select('*').eq('codigo', p.codigo);
  if (existing && existing.length > 0) {
    productIds[p.codigo] = existing[0].id;
    console.log(`Product ya existe: ${p.codigo} -> id=${existing[0].id}. Skip create.`);
  } else {
    const { is_primary, variant_label, ...insertData } = p;
    logChange(apply, `CREATE product "${p.codigo}"`, insertData);
    if (apply) {
      const { data: ins, error } = await sb.from('products').insert(insertData).select('*').single();
      if (error) { console.error(`INSERT product ${p.codigo} error:`, error); process.exit(1); }
      productIds[p.codigo] = ins.id;
      console.log(`  -> created product id=${ins.id}`);
    } else {
      productIds[p.codigo] = `(dry ${p.codigo})`;
    }
  }
}

// ── 3. Link productos a familia via product_family_members ──
for (const p of PRODUCTS) {
  const productId = productIds[p.codigo];
  // Check if link already exists
  if (apply || typeof familyId === 'number') {
    const { data: existingLink } = await sb.from('product_family_members')
      .select('*')
      .eq('family_id', familyId)
      .eq('product_id', productId);
    if (existingLink && existingLink.length > 0) {
      console.log(`Link ya existe: family_id=${familyId} product_id=${productId}. Skip.`);
      continue;
    }
  }
  const linkRow = {
    family_id: familyId,
    product_id: productId,
    is_primary: p.is_primary,
    variant_label: p.variant_label,
  };
  logChange(apply, `LINK product ${p.codigo} -> family "${FAMILY.name}" (primary=${p.is_primary})`, linkRow);
  if (apply) {
    const { error } = await sb.from('product_family_members').insert(linkRow);
    if (error) { console.error(`LINK ${p.codigo} error:`, error); process.exit(1); }
  }
}

// ── 4. Verificacion post (solo en apply) ──
if (apply) {
  console.log('\n=== VERIFICACION POST ===');
  const { data: members } = await sb.from('product_family_members').select('*').eq('family_id', familyId);
  console.log(`Family ${familyId} members: ${members?.length || 0}`);
  for (const m of members || []) {
    const { data: prod } = await sb.from('products').select('codigo, descripcion').eq('id', m.product_id).single();
    console.log(`  - ${prod?.codigo} (primary=${m.is_primary}, variant=${m.variant_label})`);
  }
}

finish(apply);
