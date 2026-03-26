#!/usr/bin/env node
/**
 * fix-pwa-amfe-effects.mjs
 *
 * Fills in the missing effectNextLevel and effectEndUser fields
 * for PWA/TELAS_PLANAS and PWA/TELAS_TERMOFORMADAS AMFEs.
 *
 * Usage: node scripts/fix-pwa-amfe-effects.mjs
 */

import { initSupabase, selectSql, execSql, close } from './supabaseHelper.mjs';
import { createHash } from 'crypto';

// ---------------------------------------------------------------------------
// Effect mappings — keyed by operation name, then failure description
// ---------------------------------------------------------------------------

const TELAS_PLANAS_MAP = {
  'RECEPCION DE MATERIA PRIMA': {
    'Gramaje Mayor a 120g/m2+15%': {
      nextLevel: 'Material no apto para proceso de espumado del cliente',
      endUser: 'Defecto funcional o dimensional en asiento terminado',
    },
    'Gramaje Menor a 120g/m2-15%': {
      nextLevel: 'Material no apto para proceso de espumado del cliente',
      endUser: 'Defecto funcional o dimensional en asiento terminado',
    },
    'Ancho de material distinto a 2m': {
      nextLevel: 'Material no apto para troquelado en planta cliente',
      endUser: 'Defecto dimensional en asiento terminado',
    },
    'Flamabilidad fuera de especificacion (100 mm/min)': {
      nextLevel: 'Material no cumple norma de seguridad del vehículo',
      endUser: 'Riesgo de seguridad ante incendio en vehículo',
    },
  },

  'RECEPCION DE PUNZONADO CON BI-COMPONENTE': {
    'Gramaje Mayor a 280g/m2+15%': {
      nextLevel: 'Material no apto para proceso de espumado del cliente',
      endUser: 'Defecto funcional o dimensional en asiento terminado',
    },
    'Flamabilidad fuera de especificacion (100 mm/min)': {
      nextLevel: 'Material no cumple norma de seguridad del vehículo',
      endUser: 'Riesgo de seguridad ante incendio en vehículo',
    },
  },

  'CORTE DE COMPONENTES': {
    'Agujeros de O4 menor a 17 por pieza': {
      nextLevel: 'Pieza no encastra correctamente en molde de espumado',
      endUser: 'Defecto dimensional en asiento terminado',
    },
    'Orificios fuera de posicion segun pieza patron': {
      nextLevel: 'Pieza no encastra correctamente en molde de espumado',
      endUser: 'Defecto dimensional en asiento terminado',
    },
    'Material distinto a punzonado de 120g/m2': {
      nextLevel: 'Material no apto para proceso de espumado del cliente',
      endUser: 'Defecto funcional en asiento terminado',
    },
  },

  'CORTE POR MAQUINA, BLANK DE PIEZAS LATERALES': {
    'Medida mayor a 550mmx500mm': {
      nextLevel: 'Blank no se posiciona correctamente en matriz de termoformado',
      endUser: 'Defecto dimensional en pieza lateral del asiento',
    },
  },

  'COLOCADO DE APLIX': {
    'Colocacion de menos de 9 aplix': {
      nextLevel: 'Tela no se fija correctamente al molde de espumado',
      endUser: 'Tela suelta o mal posicionada en asiento',
    },
    'Colocacion de Aplix en posicion distinta a la especificada': {
      nextLevel: 'Tela no se fija correctamente al molde de espumado',
      endUser: 'Tela suelta o mal posicionada en asiento',
    },
  },

  'HORNO': {
    'Temperatura del horno distinta de 150C +/-20C': {
      nextLevel: 'Material con propiedades mecánicas alteradas para espumado',
      endUser: 'Degradación prematura del material en uso',
    },
    'Calentar el material de manera no uniforme': {
      nextLevel: 'Material con propiedades mecánicas alteradas para espumado',
      endUser: 'Degradación prematura del material en uso',
    },
  },

  // OP30 - Termoformado
  'PREPARACION DE KITS DE COMPONENTES': {
    'Termoformar de forma desprolija': {
      nextLevel: 'Pieza no encaja en ensamble del cliente',
      endUser: 'Defecto visual o dimensional en asiento terminado',
    },
    'Termoformar de forma incompleta': {
      nextLevel: 'Pieza no encaja en ensamble del cliente',
      endUser: 'Defecto visual o dimensional en asiento terminado',
    },
    'Termoformado de pieza con roturas': {
      nextLevel: 'Pieza no encaja en ensamble del cliente',
      endUser: 'Defecto visual o dimensional en asiento terminado',
    },
    'Pieza con roturas': {
      nextLevel: 'Pieza no encaja en ensamble del cliente',
      endUser: 'Defecto visual o dimensional en asiento terminado',
    },
  },

  // OP40 - Corte prensa
  'COSTURA RECTA': {
    'Corte desprolijo': {
      nextLevel: 'Pieza con rebaba o incompleta no apta para ensamble',
      endUser: 'Defecto visual en asiento terminado',
    },
    'Corte Perimetral incompleto': {
      nextLevel: 'Pieza con rebaba o incompleta no apta para ensamble',
      endUser: 'Defecto visual en asiento terminado',
    },
  },

  // OP50 - Perforado
  'TROQUELADO DE REFUERZOS': {
    'Apertura de Menos de 9 agujeros': {
      nextLevel: 'Pieza no se posiciona correctamente en molde de espumado',
      endUser: 'Tela suelta o mal fijada en asiento',
    },
    'Apertura de agujeros desprolija': {
      nextLevel: 'Pieza no se posiciona correctamente en molde de espumado',
      endUser: 'Tela suelta o mal fijada en asiento',
    },
    'Apertura No pasante o incompleta': {
      nextLevel: 'Pieza no se posiciona correctamente en molde de espumado',
      endUser: 'Tela suelta o mal fijada en asiento',
    },
    'Apertura con arrastres': {
      nextLevel: 'Pieza no se posiciona correctamente en molde de espumado',
      endUser: 'Tela suelta o mal fijada en asiento',
    },
  },

  // OP60 - Soldadura
  'TROQUELADO DE APLIX': {
    'Realizar proceso con piezas distintas': {
      nextLevel: 'Pieza no mantiene integridad en proceso de espumado',
      endUser: 'Separación de piezas durante uso del asiento',
    },
    'Realizar mas de 5 puntos de soldadura en cada extremo': {
      nextLevel: 'Pieza no mantiene integridad en proceso de espumado',
      endUser: 'Separación de piezas durante uso del asiento',
    },
    'Realizar menos de 5 puntos de soldadura en cada extremo': {
      nextLevel: 'Pieza no mantiene integridad en proceso de espumado',
      endUser: 'Separación de piezas durante uso del asiento',
    },
    'No union de las piezas despues del proceso': {
      nextLevel: 'Pieza no mantiene integridad en proceso de espumado',
      endUser: 'Separación de piezas durante uso del asiento',
    },
  },

  // OP70 - Control final
  'PEGADO DE DOTS APLIX': {
    'Pieza terminada con aplix mayor o menor a 9 unidades': {
      nextLevel: 'Pieza no conforme llega a planta cliente',
      endUser: 'Defecto detectado en línea de ensamble del cliente',
    },
    'Pieza Terminada con mas o menos de 10 puntos de soldadura': {
      nextLevel: 'Pieza no conforme llega a planta cliente',
      endUser: 'Defecto detectado en línea de ensamble del cliente',
    },
    'Pieza Desunida distinta a pieza Patron': {
      nextLevel: 'Pieza no conforme llega a planta cliente',
      endUser: 'Defecto detectado en línea de ensamble del cliente',
    },
  },

  // OP80 - Embalaje
  'CONTROL FINAL DE CALIDAD': {
    'Mayor de 25 piezas por medio': {
      nextLevel: 'Error de stock en planta cliente',
      endUser: 'Sin impacto directo en usuario final',
    },
    'Menor de 25 piezas por medio': {
      nextLevel: 'Error de stock en planta cliente',
      endUser: 'Sin impacto directo en usuario final',
    },
    'Error de identificacion': {
      nextLevel: 'Pérdida de rastreabilidad en planta cliente',
      endUser: 'Sin impacto directo en usuario final',
    },
    'Falta de identificacion': {
      nextLevel: 'Pérdida de rastreabilidad en planta cliente',
      endUser: 'Sin impacto directo en usuario final',
    },
  },
};

const TELAS_TERMOFORMADAS_MAP = {
  // OP10 - Recepcion
  'RECEPCION DE MATERIA PRIMA': {
    'Identificacion incorrecta': {
      nextLevel: 'Confusión de material en planta cliente',
      endUser: 'Material incorrecto en asiento terminado',
    },
    'Material distinto segun plan de control de recepcion': {
      nextLevel: 'Material no apto para proceso del cliente',
      endUser: 'Defecto funcional en asiento terminado',
    },
    'Omision de la recepcion de material': {
      nextLevel: 'Material sin verificar ingresa al proceso',
      endUser: 'Posible defecto no detectado en asiento',
    },
  },

  // OP15 - Preparacion corte
  'PREPARACION DE CORTE': {
    'Desplazamiento involuntario del material TNT': {
      nextLevel: 'Pieza con perforaciones y aplix mal posicionados',
      endUser: 'Tela mal fijada en asiento',
    },
    'TNT plegado involuntariamente al cargar': {
      nextLevel: 'Pieza con contorno desplazado no apta para ensamble',
      endUser: 'Defecto dimensional en asiento terminado',
    },
  },

  // OP20 - Corte maquina
  'CORTE DE COMPONENTES': {
    'Largo distinto al especificado': {
      nextLevel: 'Pieza no encaja en ensamble del cliente',
      endUser: 'Defecto dimensional en asiento terminado',
    },
    'Falta de orificios': {
      nextLevel: 'Pieza no se posiciona correctamente en molde',
      endUser: 'Tela suelta o mal fijada en asiento',
    },
    'Orificios fuera de posicion': {
      nextLevel: 'Pieza no se posiciona correctamente en molde',
      endUser: 'Tela suelta o mal fijada en asiento',
    },
  },

  // OP30 - Costura
  'PREPARACION DE KITS DE COMPONENTES': {
    'Refuerzo costurado opuesto al airbag posicionado de manera inversa': {
      nextLevel: 'Pieza no cumple orientación requerida por cliente',
      endUser: 'Falla de protección ante despliegue de airbag',
    },
    'Falta de costura': {
      nextLevel: 'Pieza no cumple resistencia requerida por cliente',
      endUser: 'Rotura de costura durante uso del asiento',
    },
    'Costura floja / deficiente': {
      nextLevel: 'Pieza no cumple resistencia requerida por cliente',
      endUser: 'Degradación prematura de la costura en uso',
    },
  },

  // OP40 - Colocado clips
  'TERMOFORMADO DE TELAS': {
    'Clips colocados en posicion incorrecta': {
      nextLevel: 'Pieza no se fija correctamente en estructura del asiento',
      endUser: 'Tela suelta o con ruido en uso del asiento',
    },
    'Falta de clips': {
      nextLevel: 'Pieza no se fija correctamente en estructura del asiento',
      endUser: 'Tela suelta o con ruido en uso del asiento',
    },
  },

  // OP50 - Pegado dots
  'CORTE LASER DE TELAS TERMOFORMADAS': {
    'Dots colocados en posicion incorrecta': {
      nextLevel: 'Pieza no se fija correctamente en estructura del asiento',
      endUser: 'Tela suelta o con ruido en uso del asiento',
    },
    'Falta de dots': {
      nextLevel: 'Pieza no se fija correctamente en estructura del asiento',
      endUser: 'Tela suelta o con ruido en uso del asiento',
    },
  },

  // OP60 - Inspeccion final
  'TROQUELADO DE REFUERZOS': {
    'Dimensional fuera de especificacion': {
      nextLevel: 'Pieza no conforme llega a planta cliente',
      endUser: 'Defecto detectado en línea de ensamble del cliente',
    },
  },

  // OP70 - Embalaje
  'TROQUELADO DE APLIX': {
    'Mayor cantidad de piezas por medio': {
      nextLevel: 'Error de stock en planta cliente',
      endUser: 'Sin impacto directo en usuario final',
    },
    'Menor cantidad de piezas por medio': {
      nextLevel: 'Error de stock en planta cliente',
      endUser: 'Sin impacto directo en usuario final',
    },
    'Error de identificacion': {
      nextLevel: 'Pérdida de rastreabilidad en planta cliente',
      endUser: 'Sin impacto directo en usuario final',
    },
    'Falta de identificacion': {
      nextLevel: 'Pérdida de rastreabilidad en planta cliente',
      endUser: 'Sin impacto directo en usuario final',
    },
  },
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  await initSupabase();

  const docConfigs = [
    { projectName: 'PWA/TELAS_PLANAS', map: TELAS_PLANAS_MAP },
    { projectName: 'PWA/TELAS_TERMOFORMADAS', map: TELAS_TERMOFORMADAS_MAP },
  ];

  for (const { projectName, map } of docConfigs) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Processing: ${projectName}`);
    console.log('='.repeat(70));

    // Load document
    const rows = await selectSql(
      `SELECT id, data, checksum FROM amfe_documents WHERE project_name = ?`,
      [projectName],
    );

    if (rows.length === 0) {
      console.error(`  ERROR: No document found for ${projectName}`);
      continue;
    }

    const row = rows[0];
    const doc = JSON.parse(row.data);
    let updatedCount = 0;
    let skippedCount = 0;
    let unmatchedCount = 0;

    for (const op of doc.operations) {
      const opMap = map[op.name];
      if (!opMap) {
        console.log(`  [SKIP] No mapping for operation: "${op.name}"`);
        continue;
      }

      for (const we of op.workElements || []) {
        for (const fn of we.functions || []) {
          for (const fail of fn.failures || []) {
            const effects = opMap[fail.description];

            if (!effects) {
              console.log(`  [UNMATCHED] Op "${op.name}" / Fail "${fail.description}"`);
              unmatchedCount++;
              continue;
            }

            // Only update if both fields are empty
            if (fail.effectNextLevel === '' && fail.effectEndUser === '') {
              fail.effectNextLevel = effects.nextLevel;
              fail.effectEndUser = effects.endUser;
              updatedCount++;
              console.log(`  [UPDATED] Op "${op.name}"`);
              console.log(`            Fail: "${fail.description}"`);
              console.log(`            -> nextLevel: "${effects.nextLevel}"`);
              console.log(`            -> endUser:   "${effects.endUser}"`);
            } else {
              skippedCount++;
              console.log(`  [ALREADY SET] Op "${op.name}" / Fail "${fail.description}"`);
            }
          }
        }
      }
    }

    console.log(`\n  Summary for ${projectName}:`);
    console.log(`    Updated:   ${updatedCount}`);
    console.log(`    Skipped:   ${skippedCount} (already had values)`);
    console.log(`    Unmatched: ${unmatchedCount} (no mapping found)`);

    if (updatedCount === 0) {
      console.log('  No changes needed — skipping save.');
      continue;
    }

    // Serialize and compute new checksum
    const newDataStr = JSON.stringify(doc);
    const newChecksum = createHash('sha256').update(newDataStr).digest('hex');

    console.log(`  Old checksum: ${row.checksum}`);
    console.log(`  New checksum: ${newChecksum}`);

    // Update in Supabase
    await execSql(
      `UPDATE amfe_documents SET data = ?, checksum = ?, updated_at = NOW() WHERE id = ?`,
      [newDataStr, newChecksum, row.id],
    );

    console.log(`  Saved to Supabase.`);
  }

  close();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
