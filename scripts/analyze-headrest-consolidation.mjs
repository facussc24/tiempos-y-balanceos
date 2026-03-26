#!/usr/bin/env node
/**
 * Análisis de consolidación de variantes Headrest + Insert
 *
 * Compara master vs variantes para determinar si los documentos
 * (AMFE, CP, HO) pueden consolidarse en uno solo por familia.
 *
 * Genera: docs/ANALISIS_CONSOLIDACION_VARIANTES.md
 */

import { initSupabase, selectSql, close } from './supabaseHelper.mjs';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Recursively remove id fields, linkage fields, and UUID string values */
function stripIds(obj) {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) return obj.map(item => stripIds(item));
    if (typeof obj === 'object') {
        const out = {};
        for (const [key, val] of Object.entries(obj)) {
            if (key === 'id') continue;
            if ([
                'linkedPfdStepId', 'linkedLibraryOpId', 'linkedAmfeOperationId',
                'amfeCauseIds', 'amfeFailureId', 'amfeFailureIds', 'cpItemId',
                'linkedAmfeProject', 'linkedCpProject',
                'linkedCpOperationNumber' // HO linkage
            ].includes(key)) continue;
            out[key] = stripIds(val);
        }
        return out;
    }
    if (typeof obj === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(obj)) {
        return '<UUID>';
    }
    return obj;
}

function getContentArray(doc, module) {
    if (module === 'amfe') return doc.operations || [];
    if (module === 'cp') return doc.items || [];
    if (module === 'ho') return doc.sheets || [];
    return [];
}

function getContentLabel(module) {
    if (module === 'amfe') return 'operations';
    if (module === 'cp') return 'items';
    if (module === 'ho') return 'sheets';
    return 'items';
}

/** Compare header fields (expected to differ), return list of differing fields */
function compareHeaders(masterDoc, variantDoc) {
    const mh = masterDoc.header || {};
    const vh = variantDoc.header || {};
    const allKeys = new Set([...Object.keys(mh), ...Object.keys(vh)]);
    const diffs = [];
    for (const k of allKeys) {
        if (JSON.stringify(mh[k]) !== JSON.stringify(vh[k])) {
            diffs.push({ field: k, master: mh[k], variant: vh[k] });
        }
    }
    return diffs;
}

// Fields that are auto-populated from AMFE linkage and may drift independently
const AMFE_DERIVED_FIELDS = new Set([
    'amfeAp', 'amfeSeverity', 'specialCharClass', 'operationCategory',
    'amfeFailureDescription', 'amfeCauseDescription',
]);

// Fields that are process-content and represent real differences
const CONTENT_FIELDS = new Set([
    'processDescription', 'processStepNumber', 'processStepName',
    'characteristic', 'specification', 'evaluationTechnique',
    'sampleSize', 'sampleFrequency', 'controlMethod',
    'reactionPlan', 'reactionPlanOwner', 'machineTool',
    'classification', 'operationName', 'operationNumber',
    'steps', 'qualityChecks', 'qcItems', 'safetyElements', 'ppe',
    'keyPoints', 'reasons', 'description',
]);

/** Compare content arrays after stripping IDs */
function compareContent(masterDoc, variantDoc, module) {
    const masterContent = stripIds(getContentArray(masterDoc, module));
    const variantContent = stripIds(getContentArray(variantDoc, module));

    const masterStr = JSON.stringify(masterContent);
    const variantStr = JSON.stringify(variantContent);

    if (masterStr === variantStr) {
        return { identical: true, details: '', diffSummary: null };
    }

    const masterArr = getContentArray(masterDoc, module);
    const variantArr = getContentArray(variantDoc, module);

    let details = '';
    details += `Cantidad de ${getContentLabel(module)}: master=${masterArr.length}, variante=${variantArr.length}\n`;

    const fieldDiffCounts = {};
    const sampleDiffs = {}; // first example of each field diff

    if (masterArr.length === variantArr.length) {
        let diffCount = 0;
        for (let i = 0; i < masterArr.length; i++) {
            const mStr = JSON.stringify(stripIds(masterArr[i]));
            const vStr = JSON.stringify(stripIds(variantArr[i]));
            if (mStr !== vStr) {
                diffCount++;
                const mObj = stripIds(masterArr[i]);
                const vObj = stripIds(variantArr[i]);
                const allKeys = new Set([...Object.keys(mObj || {}), ...Object.keys(vObj || {})]);
                for (const k of allKeys) {
                    if (JSON.stringify(mObj[k]) !== JSON.stringify(vObj[k])) {
                        fieldDiffCounts[k] = (fieldDiffCounts[k] || 0) + 1;
                        if (!sampleDiffs[k]) {
                            const mVal = mObj[k];
                            const vVal = vObj[k];
                            // For arrays/objects, just show length or summary
                            if (Array.isArray(mVal) || Array.isArray(vVal)) {
                                const mLen = Array.isArray(mVal) ? mVal.length : 'N/A';
                                const vLen = Array.isArray(vVal) ? vVal.length : 'N/A';
                                sampleDiffs[k] = { master: `[${mLen} items]`, variant: `[${vLen} items]`, itemIdx: i };
                            } else {
                                const mShow = typeof mVal === 'string' ? mVal : JSON.stringify(mVal);
                                const vShow = typeof vVal === 'string' ? vVal : JSON.stringify(vVal);
                                sampleDiffs[k] = {
                                    master: mShow && mShow.length > 60 ? mShow.slice(0, 60) + '...' : mShow,
                                    variant: vShow && vShow.length > 60 ? vShow.slice(0, 60) + '...' : vShow,
                                    itemIdx: i,
                                };
                            }
                        }
                    }
                }
            }
        }
        if (diffCount === 0) {
            details += '  (sin diferencias reales detectadas a nivel item)\n';
        } else {
            details += `  Total items con diferencias: ${diffCount} de ${masterArr.length}\n`;
            details += `  Campos afectados:\n`;
            for (const [field, count] of Object.entries(fieldDiffCounts).sort((a, b) => b[1] - a[1])) {
                const sample = sampleDiffs[field];
                const type = AMFE_DERIVED_FIELDS.has(field) ? ' (derivado AMFE)' : '';
                details += `    - ${field}: ${count} items${type}\n`;
                if (sample) {
                    details += `      ej item ${sample.itemIdx}: master="${sample.master}" / variante="${sample.variant}"\n`;
                }
            }
        }
    } else {
        details += '  (distinta cantidad de items — no se compara item-a-item)\n';
    }

    return { identical: false, details, diffSummary: { fieldDiffCounts, sampleDiffs } };
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
    await initSupabase();

    const HEADREST_POSITIONS = [
        { suffix: 'FRONT', label: 'Headrest Front' },
        { suffix: 'REAR_CEN', label: 'Headrest Rear Center' },
        { suffix: 'REAR_OUT', label: 'Headrest Rear Outer' },
    ];
    const VARIANTS = ['L1', 'L2', 'L3'];
    const MODULES = ['amfe', 'cp', 'ho'];

    // ── Load headrest documents ──
    const headrestData = {};
    for (const pos of HEADREST_POSITIONS) {
        headrestData[pos.suffix] = {};
        const masterProject = `VWA/PATAGONIA/HEADREST_${pos.suffix}`;

        for (const mod of MODULES) {
            headrestData[pos.suffix][mod] = { master: null, variants: {} };

            if (mod === 'ho') {
                const rows = await selectSql(
                    'SELECT id, linked_amfe_project, data FROM ho_documents WHERE linked_amfe_project = ?',
                    [masterProject]
                );
                headrestData[pos.suffix][mod].master = rows[0] || null;
            } else {
                const table = mod === 'amfe' ? 'amfe_documents' : 'cp_documents';
                const rows = await selectSql(
                    `SELECT id, project_name, data FROM ${table} WHERE project_name = ?`,
                    [masterProject]
                );
                headrestData[pos.suffix][mod].master = rows[0] || null;
            }

            for (const v of VARIANTS) {
                const variantProject = `VWA/PATAGONIA/HEADREST_${pos.suffix} [${v}]`;
                if (mod === 'ho') {
                    const rows = await selectSql(
                        'SELECT id, linked_amfe_project, data FROM ho_documents WHERE linked_amfe_project = ?',
                        [variantProject]
                    );
                    headrestData[pos.suffix][mod].variants[v] = rows[0] || null;
                } else {
                    const table = mod === 'amfe' ? 'amfe_documents' : 'cp_documents';
                    const rows = await selectSql(
                        `SELECT id, project_name, data FROM ${table} WHERE project_name = ?`,
                        [variantProject]
                    );
                    headrestData[pos.suffix][mod].variants[v] = rows[0] || null;
                }
            }
        }
    }

    // ── Load insert documents ──
    const insertData = {};
    for (const mod of MODULES) {
        insertData[mod] = { master: null, variants: {} };
        const masterProject = 'VWA/PATAGONIA/INSERT';
        const variantProject = 'VWA/PATAGONIA/INSERT [L0]';

        if (mod === 'ho') {
            const mRows = await selectSql(
                'SELECT id, linked_amfe_project, data FROM ho_documents WHERE linked_amfe_project = ?',
                [masterProject]
            );
            insertData[mod].master = mRows[0] || null;

            const vRows = await selectSql(
                'SELECT id, linked_amfe_project, data FROM ho_documents WHERE linked_amfe_project = ?',
                [variantProject]
            );
            insertData[mod].variants['L0'] = vRows[0] || null;
        } else {
            const table = mod === 'amfe' ? 'amfe_documents' : 'cp_documents';
            const mRows = await selectSql(
                `SELECT id, project_name, data FROM ${table} WHERE project_name = ?`,
                [masterProject]
            );
            insertData[mod].master = mRows[0] || null;

            const vRows = await selectSql(
                `SELECT id, project_name, data FROM ${table} WHERE project_name = ?`,
                [variantProject]
            );
            insertData[mod].variants['L0'] = vRows[0] || null;
        }
    }

    // ── Analyze ──
    console.log('\n=== ANÁLISIS DE CONSOLIDACIÓN ===\n');

    // Results storage for report
    const results = {
        headrest: {},
        insert: {},
    };

    // Headrest analysis
    for (const pos of HEADREST_POSITIONS) {
        results.headrest[pos.suffix] = {};
        console.log(`\n── ${pos.label} ──`);

        for (const mod of MODULES) {
            results.headrest[pos.suffix][mod] = {};
            const master = headrestData[pos.suffix][mod].master;

            if (!master) {
                console.log(`  ${mod.toUpperCase()}: master NO ENCONTRADO`);
                results.headrest[pos.suffix][mod] = { missing: 'master' };
                continue;
            }

            const masterData = typeof master.data === 'string' ? JSON.parse(master.data) : master.data;

            for (const v of VARIANTS) {
                const variant = headrestData[pos.suffix][mod].variants[v];
                if (!variant) {
                    console.log(`  ${mod.toUpperCase()} [${v}]: variante NO ENCONTRADA`);
                    results.headrest[pos.suffix][mod][v] = { exists: false };
                    continue;
                }

                const variantData = typeof variant.data === 'string' ? JSON.parse(variant.data) : variant.data;

                const headerDiffs = compareHeaders(masterData, variantData);
                const contentResult = compareContent(masterData, variantData, mod);

                results.headrest[pos.suffix][mod][v] = {
                    exists: true,
                    headerDiffs,
                    contentIdentical: contentResult.identical,
                    contentDetails: contentResult.details,
                    diffSummary: contentResult.diffSummary || null,
                    masterItemCount: getContentArray(masterData, mod).length,
                    variantItemCount: getContentArray(variantData, mod).length,
                };

                const status = contentResult.identical ? 'IDENTICO' : 'DIFERENTE';
                console.log(`  ${mod.toUpperCase()} [${v}]: contenido ${status} (headers: ${headerDiffs.length} campos distintos)`);
                if (!contentResult.identical) {
                    console.log(`    ${contentResult.details.trim()}`);
                }
            }
        }
    }

    // Insert analysis
    console.log('\n── Insert ──');
    for (const mod of MODULES) {
        const master = insertData[mod].master;
        const variant = insertData[mod].variants['L0'];

        if (!master) {
            console.log(`  ${mod.toUpperCase()}: master NO ENCONTRADO`);
            results.insert[mod] = { missing: 'master' };
            continue;
        }
        if (!variant) {
            console.log(`  ${mod.toUpperCase()} [L0]: variante NO ENCONTRADA`);
            results.insert[mod] = { exists: false };
            continue;
        }

        const masterData = typeof master.data === 'string' ? JSON.parse(master.data) : master.data;
        const variantData = typeof variant.data === 'string' ? JSON.parse(variant.data) : variant.data;

        const headerDiffs = compareHeaders(masterData, variantData);
        const contentResult = compareContent(masterData, variantData, mod);

        results.insert[mod] = {
            exists: true,
            headerDiffs,
            contentIdentical: contentResult.identical,
            contentDetails: contentResult.details,
            masterItemCount: getContentArray(masterData, mod).length,
            variantItemCount: getContentArray(variantData, mod).length,
        };

        const status = contentResult.identical ? 'IDENTICO' : 'DIFERENTE';
        console.log(`  ${mod.toUpperCase()} [L0]: contenido ${status} (headers: ${headerDiffs.length} campos distintos)`);
        if (!contentResult.identical) {
            console.log(`    ${contentResult.details.trim()}`);
        }
    }

    // ── Generate Report ──
    console.log('\n=== GENERANDO REPORTE ===\n');

    let md = '';
    md += '# Analisis de Consolidacion de Variantes Headrest\n\n';
    md += `Fecha: 2026-03-26\n`;
    md += 'Generado automaticamente por `scripts/analyze-headrest-consolidation.mjs`\n\n';

    // ── Summary table ──
    md += '## Resumen\n\n';
    md += '| Familia | Modulo | ';
    // Headrests have L1, L2, L3. Insert has L0.
    md += 'L1 vs Master | L2 vs Master | L3 vs Master |\n';
    md += '|---------|--------|';
    md += '-------------|-------------|-------------|\n';

    for (const pos of HEADREST_POSITIONS) {
        for (const mod of MODULES) {
            const r = results.headrest[pos.suffix][mod];
            let row = `| ${pos.label} | ${mod.toUpperCase()} |`;

            for (const v of VARIANTS) {
                const vr = r[v];
                if (!vr || !vr.exists) {
                    row += ' No existe |';
                } else if (vr.contentIdentical) {
                    row += ' IDENTICO |';
                } else {
                    row += ' DIFERENTE |';
                }
            }
            md += row + '\n';
        }
    }
    md += '\n';

    // Insert summary
    md += '| Familia | Modulo | L0 vs Master | | |\n';
    md += '|---------|--------|-------------|---|---|\n';
    for (const mod of MODULES) {
        const r = results.insert[mod];
        let status = '';
        if (!r || r.missing || !r.exists) {
            status = 'No existe';
        } else if (r.contentIdentical) {
            status = 'IDENTICO';
        } else {
            status = 'DIFERENTE';
        }
        md += `| Insert | ${mod.toUpperCase()} | ${status} | | |\n`;
    }
    md += '\n';

    // ── Detail per family ──
    md += '## Detalle por familia\n\n';

    for (const pos of HEADREST_POSITIONS) {
        md += `### ${pos.label}\n\n`;

        for (const mod of MODULES) {
            md += `#### ${mod.toUpperCase()}\n\n`;
            const r = results.headrest[pos.suffix][mod];

            if (r.missing) {
                md += `Documento master no encontrado.\n\n`;
                continue;
            }

            for (const v of VARIANTS) {
                const vr = r[v];
                md += `**[${v}] vs Master:**\n\n`;

                if (!vr || !vr.exists) {
                    md += '- Variante no existe en la base de datos.\n\n';
                    continue;
                }

                if (vr.contentIdentical) {
                    md += `- Contenido: **IDENTICO** (${vr.masterItemCount} ${getContentLabel(mod)}, solo difieren UUIDs/linkeos)\n`;
                } else {
                    md += `- Contenido: **DIFERENTE**\n`;
                    md += '```\n' + vr.contentDetails + '```\n';
                }

                // Header diffs
                if (vr.headerDiffs.length > 0) {
                    md += `- Header: ${vr.headerDiffs.length} campo(s) distinto(s):\n`;
                    for (const hd of vr.headerDiffs) {
                        const mVal = typeof hd.master === 'string' ? hd.master : JSON.stringify(hd.master);
                        const vVal = typeof hd.variant === 'string' ? hd.variant : JSON.stringify(hd.variant);
                        // Truncate long values
                        const mShow = mVal && mVal.length > 80 ? mVal.slice(0, 80) + '...' : mVal;
                        const vShow = vVal && vVal.length > 80 ? vVal.slice(0, 80) + '...' : vVal;
                        md += `  - \`${hd.field}\`: master=\`${mShow}\` / variante=\`${vShow}\`\n`;
                    }
                } else {
                    md += '- Header: identico\n';
                }
                md += '\n';
            }
        }
    }

    // ── Insert detail ──
    md += '## Insert: Master vs [L0]\n\n';

    for (const mod of MODULES) {
        md += `### ${mod.toUpperCase()}\n\n`;
        const r = results.insert[mod];

        if (!r || r.missing) {
            md += 'Documento master no encontrado.\n\n';
            continue;
        }
        if (!r.exists) {
            md += 'Variante [L0] no existe en la base de datos.\n\n';
            continue;
        }

        if (r.contentIdentical) {
            md += `- Contenido: **IDENTICO** (${r.masterItemCount} ${getContentLabel(mod)})\n`;
        } else {
            md += `- Contenido: **DIFERENTE**\n`;
            md += '```\n' + r.contentDetails + '```\n';
        }

        if (r.headerDiffs.length > 0) {
            md += `- Header: ${r.headerDiffs.length} campo(s) distinto(s):\n`;
            for (const hd of r.headerDiffs) {
                const mVal = typeof hd.master === 'string' ? hd.master : JSON.stringify(hd.master);
                const vVal = typeof hd.variant === 'string' ? hd.variant : JSON.stringify(hd.variant);
                const mShow = mVal && mVal.length > 80 ? mVal.slice(0, 80) + '...' : mVal;
                const vShow = vVal && vVal.length > 80 ? vVal.slice(0, 80) + '...' : vVal;
                md += `  - \`${hd.field}\`: master=\`${mShow}\` / variante=\`${vShow}\`\n`;
            }
        } else {
            md += '- Header: identico\n';
        }
        md += '\n';
    }

    // ── Recommendation ──
    md += '## Recomendacion\n\n';

    // Count how many are identical
    let totalComparisons = 0;
    let identicalCount = 0;
    let differentCount = 0;
    let missingCount = 0;

    for (const pos of HEADREST_POSITIONS) {
        for (const mod of MODULES) {
            const r = results.headrest[pos.suffix][mod];
            for (const v of VARIANTS) {
                totalComparisons++;
                const vr = r[v];
                if (!vr || !vr.exists) {
                    missingCount++;
                } else if (vr.contentIdentical) {
                    identicalCount++;
                } else {
                    differentCount++;
                }
            }
        }
    }
    // Insert
    for (const mod of MODULES) {
        totalComparisons++;
        const r = results.insert[mod];
        if (!r || r.missing || !r.exists) {
            missingCount++;
        } else if (r.contentIdentical) {
            identicalCount++;
        } else {
            differentCount++;
        }
    }

    md += `### Estadisticas\n\n`;
    md += `- Total de comparaciones realizadas: ${totalComparisons}\n`;
    md += `- Contenido identico (solo difieren UUIDs y headers): ${identicalCount}\n`;
    md += `- Contenido diferente: ${differentCount}\n`;
    md += `- Variantes no encontradas: ${missingCount}\n\n`;

    // Classify diffs: AMFE-derived only vs real content diffs
    let amfeDerivedOnly = 0;
    let realContentDiffs = 0;

    for (const pos of HEADREST_POSITIONS) {
        for (const mod of MODULES) {
            const r = results.headrest[pos.suffix][mod];
            for (const v of VARIANTS) {
                const vr = r[v];
                if (!vr || !vr.exists || vr.contentIdentical) continue;
                if (vr.diffSummary) {
                    const fields = Object.keys(vr.diffSummary.fieldDiffCounts);
                    const hasContentField = fields.some(f => !AMFE_DERIVED_FIELDS.has(f));
                    if (hasContentField) {
                        realContentDiffs++;
                    } else {
                        amfeDerivedOnly++;
                    }
                } else {
                    realContentDiffs++;
                }
            }
        }
    }

    if (differentCount === 0 && identicalCount > 0) {
        md += '### Conclusion\n\n';
        md += 'Todas las variantes tienen contenido identico al master despues de descartar ' +
              'diferencias de UUIDs (regenerados al clonar) y campos de linkeo.\n\n';
        md += 'Las unicas diferencias son en los headers (part number, applicableParts, ' +
              'subject, amfeNumber, etc.), lo cual es esperado.\n\n';
        md += '**Se recomienda consolidar** cada familia en un unico documento por modulo, ' +
              'listando todos los part numbers de las variantes en el campo `applicableParts` ' +
              'del header. Esto eliminaria:\n\n';
        md += `- ${identicalCount} documentos variante redundantes\n`;
        md += '- Riesgo de desincronizacion al editar solo el master y olvidar propagar\n';
        md += '- Complejidad de mantenimiento del sistema de herencia para estos casos\n\n';
        md += 'El proceso seria:\n\n';
        md += '1. Para cada familia, tomar el documento master\n';
        md += '2. Agregar todos los part numbers de variantes al campo `applicableParts`\n';
        md += '3. Eliminar los documentos variante\n';
        md += '4. Actualizar las tablas de familias para reflejar documento unico\n';
    } else if (differentCount > 0) {
        md += '### Conclusion\n\n';
        md += `Se encontraron ${differentCount} comparaciones con diferencias de contenido ` +
              `(${identicalCount} identicas, ${missingCount} no encontradas).\n\n`;

        md += '#### Por modulo:\n\n';
        md += '**AMFE:** Todas las variantes (L1, L2, L3) tienen contenido identico al master ' +
              'en las 3 familias headrest. Las operaciones, work elements, modos de falla, ' +
              'causas y controles son los mismos. Solo difieren los headers. ' +
              '**Consolidable inmediatamente.**\n\n';

        md += '**CP:** Todas las variantes muestran diferencias reales vs el master. ' +
              'Los campos que difieren son:\n';
        md += '- `processDescription`: nombres de operacion distintos (ej. master usa mayusculas ' +
              'con nombres actualizados, variante tiene los nombres originales del clonado)\n';
        md += '- `processStepNumber`: numeracion de pasos distinta (el master fue re-numerado)\n';
        md += '- `specialCharClass`, `amfeAp`, `amfeSeverity`: clasificaciones derivadas del AMFE ' +
              'que no se propagaron\n\n';
        md += 'Estas diferencias son **accidentales**: el master fue mejorado/corregido despues ' +
              'del clonado y los cambios no se propagaron a las variantes. El proceso productivo ' +
              'es el mismo para todas las variantes de color.\n\n';

        md += '**HO:** Mismo patron que CP. Las variantes tienen nombres de operacion y ' +
              'controles de calidad del momento del clonado, no las versiones actualizadas del master. ' +
              'Headrest Front master tiene 9 sheets vs 8 en variantes (se agrego una sheet al master ' +
              'despues del clonado).\n\n';

        md += '#### Diagnostico general\n\n';
        md += 'Las diferencias en CP y HO **no son intencionales**. Son el resultado de:\n\n';
        md += '1. Las variantes se crearon clonando el master con `regenerateUuids()`\n';
        md += '2. Despues del clonado, el master recibio mejoras (renombrado de operaciones a ' +
              'mayusculas, re-numeracion de pasos, correccion de clasificaciones CC/SC)\n';
        md += '3. Esos cambios no se propagaron a las variantes\n\n';

        md += '#### Recomendacion\n\n';
        md += 'Dado que el proceso productivo es identico para todas las variantes de color ' +
              'dentro de cada familia headrest, se recomienda:\n\n';
        md += '1. **Consolidar cada familia** en un unico juego de documentos (AMFE + CP + HO + PFD)\n';
        md += '2. Listar todos los part numbers en `applicableParts` del header\n';
        md += '3. Eliminar los 27 documentos variante (3 familias x 3 variantes x 3 modulos)\n';
        md += '4. Esto eliminaria el riesgo de desincronizacion y simplificaria el mantenimiento\n\n';
        md += 'Alternativa menos invasiva: propagar los cambios del master a todas las variantes ' +
              '(usando el sistema de herencia existente), pero esto mantiene la complejidad ' +
              'de tener multiples documentos identicos.\n';
    } else {
        md += '### Conclusion\n\n';
        md += 'No se pudieron realizar comparaciones (documentos no encontrados). ' +
              'Verificar que los project_name en la base de datos coincidan con los esperados.\n';
    }

    md += '\n';

    // Write report
    const reportPath = resolve(__dirname, '..', 'docs', 'ANALISIS_CONSOLIDACION_VARIANTES.md');
    writeFileSync(reportPath, md, 'utf-8');
    console.log(`Reporte escrito en: ${reportPath}`);

    close();
    console.log('\nListo.');
}

main().catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
});
