import { useState } from 'react';
import { ProjectData } from '../types';
import { parseNumberInput, calculateWeightedLineOEE } from '../utils';
import { toast } from '../components/ui/Toast';

export const useOEELogic = (data: ProjectData, updateData: (data: ProjectData) => void) => {
    // OEE Input State: Always show 0-100 value (e.g. "85.5")
    const [oeeInput, setOeeInput] = useState((data.meta.manualOEE * 100).toString());

    // Track the last externally-synced value so we can reset oeeInput when it
    // changes from outside (e.g. project loaded). Using "adjust state during
    // render" pattern instead of setState-in-effect (React 19 rule).
    const [lastSyncedOEE, setLastSyncedOEE] = useState(data.meta.manualOEE);
    if (lastSyncedOEE !== data.meta.manualOEE) {
        setLastSyncedOEE(data.meta.manualOEE);
        setOeeInput(parseFloat((data.meta.manualOEE * 100).toFixed(2)).toString());
    }

    // Calculate Weighted OEE from Sectors
    const weightedOEE = calculateWeightedLineOEE(data);

    // Effective OEE used for calculation (Weighted OR Manual)
    const activeOEE = data.meta.useSectorOEE ? weightedOEE : data.meta.manualOEE;

    // V8.2: Setup Loss Percent (exposed for UI)
    const setupLossPercent = data.meta.setupLossPercent || 0;

    const handleMetaChange = (field: keyof typeof data.meta, value: ProjectData['meta'][keyof ProjectData['meta']]) => {
        updateData({
            ...data,
            meta: { ...data.meta, [field]: value },
        });
    };

    const handleOeeChange = (val: string) => {
        setOeeInput(val);
        const num = parseNumberInput(val);
        if (num >= 0 && num <= 100) {
            const previousOEE = data.meta.manualOEE * 100;

            // V8.2: Mutual Exclusion - Auto-clear setupLossPercent if OEE < 100%
            const updates: Partial<typeof data.meta> = { manualOEE: num / 100 };
            if (num < 100 && (data.meta.setupLossPercent || 0) > 0) {
                updates.setupLossPercent = 0;
                toast.info(
                    'Setup Loss Desactivado',
                    'El OEE Global ya incluye pérdidas por Setup. El campo Setup Loss se ha reseteado a 0%.'
                );
            }

            updateData({
                ...data,
                meta: { ...data.meta, ...updates },
            });

            // RC1 HOTFIX: Toast notification for OEE change
            // Informs user the change was registered (workaround for reactivity lag)
            if (Math.abs(num - previousOEE) > 5) {
                toast.info(
                    'OEE Actualizado',
                    `Eficiencia global: ${num}%. Navegue a Balanceo para ver el impacto.`
                );
            }
        }
    };

    // V8.2: Setup Loss Change Handler with Mutual Exclusion
    const handleSetupLossChange = (val: number) => {
        // Clamp to valid range: 0-20%
        const clampedVal = Math.min(0.20, Math.max(0, val));

        // Mutual Exclusion: Block if OEE is active (< 100%)
        if (data.meta.manualOEE < 1.0 && clampedVal > 0) {
            toast.warning(
                'Campo Bloqueado',
                'El OEE Global ya incluye las pérdidas por Setup (ISO 22400). Para usar Setup Loss explícito, establezca OEE en 100%.'
            );
            return false;
        }

        handleMetaChange('setupLossPercent', clampedVal);
        return true;
    };

    const toggleSectorOEE = (useSector: boolean) => {
        // FIX: Atomic update to prevent stale state race condition
        // Previously two sequential handleMetaChange calls caused the second
        // to overwrite the first because React hadn't updated `data` yet.
        const updates: Partial<typeof data.meta> = { useSectorOEE: useSector };
        if (!useSector) {
            updates.useManualOEE = true;
        }
        updateData({
            ...data,
            meta: { ...data.meta, ...updates },
        });
    };

    return {
        oeeInput,
        weightedOEE,
        activeOEE,
        setupLossPercent, // V8.2: Expose for UI
        handleOeeChange,
        handleSetupLossChange, // V8.2: New handler with mutual exclusion
        toggleSectorOEE,
        handleMetaChange // Expose for generic meta updates if needed
    };
};
