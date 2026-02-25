/**
 * Smoke Test: Generate Excel Export for Validation
 * 
 * This script generates the Heijunka Excel report with the stress-test scenario:
 * - Pitch: 10 minutes
 * - Slots: 48 columns
 * - Mix: A=360 (15/slot), B=120 (5/slot) → proportional in smaller slots
 * 
 * Run with: npx ts-node --esm scripts/smoke_test_export.ts
 */

import { calculateHeijunka, ProductDemand } from '../modules/heijunka/heijunkaLogic';
import { exportHeijunkaPlanExcel } from '../modules/heijunka/heijunkaExport';

// Stress test scenario data
const AVAILABLE_MINUTES = 480;
const PITCH_MINUTES = 10;  // Stress test: pack-out = 10
const MODEL_A_DEMAND = 360;
const MODEL_B_DEMAND = 120;

const products: ProductDemand[] = [
    {
        productId: 'A',
        productName: 'Modelo A (Estándar)',
        dailyDemand: MODEL_A_DEMAND,
        cycleTimeSeconds: 55,
        color: '#3B82F6'  // Blue
    },
    {
        productId: 'B',
        productName: 'Modelo B (Lujo)',
        dailyDemand: MODEL_B_DEMAND,
        cycleTimeSeconds: 58,
        color: '#10B981'  // Green
    }
];

console.log('🧪 Smoke Test: Generando Excel con escenario de estrés...\n');
console.log('📊 Datos de entrada:');
console.log(`   - Tiempo Disponible: ${AVAILABLE_MINUTES} min`);
console.log(`   - Pitch: ${PITCH_MINUTES} min`);
console.log(`   - Modelo A: ${MODEL_A_DEMAND} unidades`);
console.log(`   - Modelo B: ${MODEL_B_DEMAND} unidades`);
console.log('');

// Calculate Heijunka
const result = calculateHeijunka(products, AVAILABLE_MINUTES, PITCH_MINUTES, '08:00');

console.log('📈 Resultado Heijunka:');
console.log(`   - Total Slots: ${result.totalSlots}`);
console.log(`   - Modelo A asignado: ${result.productSummaries[0].totalAssigned}`);
console.log(`   - Modelo B asignado: ${result.productSummaries[1].totalAssigned}`);
console.log('');

// Show first few slots for verification
console.log('📋 Primeros 5 slots (muestra para Mizusumashi):');
for (let i = 0; i < 5; i++) {
    const slot = result.slots[i];
    const aQty = slot.assignments.find(a => a.productId === 'A')?.quantity || 0;
    const bQty = slot.assignments.find(a => a.productId === 'B')?.quantity || 0;
    console.log(`   ${slot.startTime} → Recoger ${aQty} cajas A, ${bQty} cajas B`);
}
console.log('   ...');
console.log('');

// Export to Excel
console.log('📁 Exportando a Excel...');
try {
    exportHeijunkaPlanExcel(
        result,
        'Panel_de_Instrumentos',
        'Ruta Mizusumashi A',
        '2025-12-21'
    );
    console.log('✅ Excel generado exitosamente!');
    console.log('   Busca el archivo: Panel_de_Instrumentos_Heijunka_*.xlsx');
} catch (error) {
    console.error('❌ Error al exportar:', error);
}
