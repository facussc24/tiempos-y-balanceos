/**
 * AMFE de los apoyacabezas (151, 153, 155) y del Top Roll (162) alineados a los flujogramas 152 Rev.C y
 * 155 Rev.D: un sector es un bloque (skill flujogramas 1.5; Fak, 06/10/2026: "esos tambien tienen que ser
 * unificados en criterio"). Mismo metodo que `_amfeIpPad157C.mjs`: las filas quedan cubriendo los pasos
 * del flujograma con un rango; no se parte ni se reescribe contenido.
 *
 *   152 Rev.C: corte 20-21 (antes "OP 20-27"), mylar 22 (antes 28), costura union 30 (deja de llamarse
 *              "OP 30 / 32-34": el flujograma ya no dibuja 32 a 34, que son pasos de las HO 968/969/970).
 *   155 Rev.D: inyeccion 10-11 (el control de pieza inyectada ya estaba adentro de la OP 10 desde el
 *              20/08/2026), adhesivado 20-21 y plegado 50-51. Las filas 20 y 50 conservan su nombre: el
 *              control que el flujograma dibuja en 21 y en 51 es su control de deteccion, y el AMFE no
 *              tiene modos de falla propios de esos dos controles (los define el equipo).
 *
 * El flujograma manda: la fecha de la fila de revision sale del flujograma EMITIDO
 * (`tools/flowchart/data/<clave>.json`), y sin el flujograma en la revision esperada el `--apply` se niega.
 * En la misma tanda hay que actualizar `scripts/_lib/numeracionPatagonia.data.json`.
 *
 * Uso:  node scripts/_amfeSectorBloque152C155D.mjs            (dry-run)
 *       node scripts/_amfeSectorBloque152C155D.mjs --apply
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectSupabase, readAmfe, saveAmfe } from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation, logChange, finish } from './_lib/dryRunGuard.mjs';

const DATA = path.resolve(fileURLToPath(import.meta.url), '../../tools/flowchart/data');
// viejo -> [nuevo, nombre nuevo | null = conserva el nombre]
const CORTE = {
    '20': ['20-21', 'PREPARACION Y CARGA DE VINILO Y CORTE AUTOMATICO DE COMPONENTES'],
    '28': ['22', 'CONTROL CON MYLAR'],
    '30': ['30', 'COSTURA UNION'],
};
const APC = {
    flujo: '152-APOYACABEZAS', rev: 'C', cambios: CORTE, item: '20-21, 22, 30',
    detalle: 'SE ALINEA CON EL FLUJOGRAMA 152 REV. C: EL CORTE PASA A NUMERARSE 20-21 (PREPARACION Y CORTE AUTOMATICO), EL CONTROL CON MYLAR PASA DE 28 A 22 Y LA COSTURA UNION QUEDA COMO OPERACION 30.',
};
const PLAN = {
    'AMFE-HF-PAT': APC,
    'AMFE-HRC-PAT': APC,
    'AMFE-HRO-PAT': APC,
    'AMFE-TR-PAT': {
        flujo: '155-TOP-ROLL', rev: 'D', item: '10-11, 20-21, 50-51',
        cambios: {
            '10': ['10-11', 'INYECCIÓN DE PIEZA PLÁSTICA Y CONTROL DE PIEZA INYECTADA'],
            '20': ['20-21', null],
            '50': ['50-51', null],
        },
        detalle: 'SE ALINEA CON EL FLUJOGRAMA 155 REV. D: LA INYECCION PASA A NUMERARSE 10-11 (INYECCION Y CONTROL DE PIEZA INYECTADA), EL ADHESIVADO 20-21 (ADHESIVADO HOT MELT E INSPECCION DE LAMINA ADHESIVADA) Y EL PLEGADO 50-51 (PLEGADO DE BORDES Y CONTROL DE ADHERENCIA POST-PLEGADO).',
    },
};

const { apply } = parseSafeArgs();
const aDia = (s) => { const m = String(s ?? '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? Number(m[3] + m[2] + m[1]) : 0; };
const hoy = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** Fecha de la fila = la de la revision emitida del flujograma. Sin emitir: el dry-run avisa y el apply se niega. */
function fechaDelFlujograma({ flujo, rev }) {
    const h = JSON.parse(fs.readFileSync(path.join(DATA, `${flujo}.json`), 'utf8')).header;
    if (h.revision === rev) return h.revisionDate;
    const falta = `el flujograma ${flujo} esta en Rev.${h.revision}, no en Rev.${rev}: primero se emite el flujograma`;
    if (apply) throw new Error(falta);
    console.log(`   ⚠ ${falta}. En seco se muestra con la fecha de hoy; con --apply esto frena.`);
    return hoy;
}

/** 'hecho' | 'pendiente', o tira si la fila no esta en ninguno de los dos estados o el numero destino esta ocupado. */
function estadoDelCambio(numero, ops, viejo, [nuevo, nombre]) {
    const con = (n) => ops.filter((o) => String(o.opNumber) === n);
    const nombreDe = (o) => String(o.name ?? o.operationName ?? '');
    if (nuevo === viejo) {
        if (con(viejo).length !== 1) throw new Error(`${numero}: esperaba una sola OP ${viejo} y hay ${con(viejo).length}`);
        return nombreDe(con(viejo)[0]) === nombre ? 'hecho' : 'pendiente';
    }
    const [v, n] = [con(viejo), con(nuevo)];
    if (v.length === 1 && n.length === 0) return 'pendiente';
    if (v.length === 0 && n.length === 1 && (nombre === null || nombreDe(n[0]) === nombre)) return 'hecho';
    if (v.length && n.length) throw new Error(`${numero}: la OP ${viejo} tiene que pasar a ${nuevo} y el ${nuevo} ya esta ocupado`);
    throw new Error(`${numero}: no encontre la OP ${viejo} ni la ${nuevo} como las espera el plan`);
}

const sb = await connectSupabase();
const lote = [];

for (const [numero, plan] of Object.entries(PLAN)) {
    const { data: rows, error } = await sb.from('amfe_documents').select('id, amfe_number, project_name').eq('amfe_number', numero);
    if (error) throw error;
    if (rows.length !== 1) throw new Error(`Esperaba 1 ${numero}, encontre ${rows.length}`);
    const row = rows[0];
    const { doc } = await readAmfe(sb, row.id);
    const antes = JSON.parse(JSON.stringify(doc));
    const ops = doc.operations || [];
    doc.revisions = Array.isArray(doc.revisions) ? doc.revisions : [];
    const estados = Object.entries(plan.cambios).map(([viejo, c]) => [viejo, c, estadoDelCambio(numero, ops, viejo, c)]);
    const filaYa = doc.revisions.some((r) => r.item === plan.item && r.details === plan.detalle);
    if (estados.every(([, , e]) => e === 'hecho') && filaYa) {
        console.log(`${numero}: ya esta alineado, no hay nada que hacer.`);
        continue;
    }
    console.log(`\n=== ${numero} ===`);
    const fecha = fechaDelFlujograma(plan);
    for (const [viejo, [nuevo, nombre], estado] of estados) {
        if (estado === 'hecho') continue;
        const op = ops.find((o) => String(o.opNumber) === viejo);
        const nombreViejo = String(op.name ?? op.operationName);
        op.opNumber = nuevo;
        op.operationNumber = nuevo;
        if (nombre !== null) {
            op.name = nombre;
            op.operationName = nombre;
        }
        logChange(apply, `${numero} OP ${viejo} -> ${nuevo}`, { antes: `${viejo}  ${nombreViejo}`, despues: `${nuevo}  ${nombre ?? nombreViejo}` });
    }
    // Un texto que cite por numero una operacion que cambia quedaria apuntando a otra: se listan, no se reescriben solos.
    const viejos = Object.keys(plan.cambios).filter((v) => plan.cambios[v][0] !== v);
    const re = /\b(?:OP\.?|OPERACI[OÓ]N)\s*(\d{1,3})\b/gi;
    (function barrer(o, ruta, nivel) {
        if (typeof o === 'string') {
            for (const m of o.matchAll(re)) {
                const num = Number(m[1]);
                if (viejos.includes(m[1]) || (plan === APC && num >= 21 && num <= 34)) console.log(`   cita a mirar  ${ruta}: ${o.slice(0, 130)}`);
            }
        } else if (Array.isArray(o)) {
            o.forEach((x, i) => barrer(x, `${ruta}[${i}]`, nivel + 1));
        } else if (o && typeof o === 'object') {
            // nivel 1 = la operacion: su propio nombre ya se cambio arriba; los nombres de mas adentro si se miran
            for (const [k, v] of Object.entries(o)) if (!(nivel === 1 && (k === 'name' || k === 'operationName'))) barrer(v, `${ruta}.${k}`, nivel);
        }
    })(ops, 'operations', 0);

    if (!filaYa) {
        const letras = doc.revisions.map((r) => String(r.rev ?? '').trim()).filter((l) => /^[A-Z]$/.test(l)).sort();
        const letra = letras.at(-1) ?? String(doc.header?.revision ?? doc.header?.rev ?? '').trim();
        if (!/^[A-Z]$/.test(letra)) throw new Error(`${numero}: no pude leer la letra de revision vigente`);
        const ultima = Math.max(0, ...doc.revisions.map((r) => aDia(r.date)));
        if (ultima > aDia(fecha)) throw new Error(`${numero}: ya tiene una fila de revision posterior al ${fecha}; la fecha no puede ir para atras`);
        doc.revisions.push({ rev: letra, date: fecha, item: plan.item, details: plan.detalle, pswDate: '', modifiedBy: 'FS' });
        logChange(apply, `${numero} fila de revision`, { rev: letra, fecha, item: plan.item });
        console.log(`       detalle: ${plan.detalle}`);
        doc.header = doc.header || {};
        if (doc.header.revDate !== fecha) {
            logChange(apply, `${numero} fecha de revision de la caratula`, { antes: String(doc.header.revDate), despues: fecha });
            doc.header.revDate = fecha;
        }
    }
    console.log(`   secuencia final: ${ops.map((o) => o.opNumber).join(' ')}`);
    lote.push({ id: row.id, amfeNumber: row.amfe_number, productName: row.project_name, before: antes, after: doc });
}

if (lote.length) {
    await runWithValidation(lote, apply, async () => {
        for (const d of lote) {
            await saveAmfe(sb, d.id, d.after, { expectedAmfeNumber: d.amfeNumber });
            console.log(`   escrito ${d.amfeNumber}`);
        }
    });
}
finish(apply);
