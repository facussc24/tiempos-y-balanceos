import { useState, useEffect } from 'react';
import { Task, ManualOperation } from '../../../types';
import { parseNumberInput } from '../../../utils';

export const useInjectionState = (task: Task, projectTasks: Task[] = []) => {
    // 1. MACHINE PARAMETERS
    const [puInyTimeStr, setPuInyTimeStr] = useState(
        (task.injectionParams?.pInyectionTime ? task.injectionParams.pInyectionTime : 20).toString()
    );
    const [puCurTimeStr, setPuCurTimeStr] = useState(
        (task.injectionParams?.pCuringTime ? task.injectionParams.pCuringTime : 120).toString()
    );

    // 2. MANUAL OPERATIONS
    // Merge internal manual ops with Project Tasks marked as concurrent with this machine
    const concurrentOps: ManualOperation[] = projectTasks
        .filter(t => t.concurrentWith === task.id)
        .map(t => ({
            id: t.id,
            description: t.description,
            time: t.standardTime || t.averageTime, // Use calculated standard time or avg
            type: t.isMachineInternal ? 'internal' : 'external' // Map the flag
        }));

    const [manualOps, setManualOps] = useState<ManualOperation[]>(
        [...(task.injectionParams?.manualOperations || []), ...concurrentOps]
    );

    const initialManualTime = task.injectionParams?.manualInteractionTime;
    const calcManualTime = manualOps.reduce((acc, op) => acc + op.time, 0);

    const [manualTimeOverrideStr, setManualTimeOverrideStr] = useState<string | null>(
        initialManualTime && initialManualTime !== calcManualTime
            ? initialManualTime.toString()
            : null
    );

    const addManualOp = (op: ManualOperation) => {
        setManualOps([...manualOps, op]);
        setManualTimeOverrideStr(null); // Switch to auto mode
    };

    const removeManualOp = (id: string) => {
        setManualOps(manualOps.filter(op => op.id !== id));
        setManualTimeOverrideStr(null);
    };

    const toggleOpType = (id: string) => {
        setManualOps(manualOps.map(op =>
            op.id === id ? { ...op, type: op.type === 'external' ? 'internal' : 'external' } : op
        ));
    };

    // 3. CAVITIES (N)
    const [userSelectedN, setUserSelectedN] = useState<number>(
        task.injectionParams?.userSelectedN ? Number(task.injectionParams.userSelectedN) : (task.injectionParams?.optimalCavities || 1)
    );
    const [cavityMode, setCavityMode] = useState<'auto' | 'manual'>(
        task.injectionParams?.cavityMode || 'auto'
    );

    const updateCavities = (delta: number) => {
        if (cavityMode === 'auto') return;
        const current = userSelectedN;
        const next = Math.max(1, Math.min(64, current + delta));
        setUserSelectedN(next);
    };

    // 4. HEADCOUNT
    const [headcountMode, setHeadcountMode] = useState<'auto' | 'manual'>(
        task.injectionParams?.headcountMode || 'auto'
    );
    const [userHeadcountStr, setUserHeadcountStr] = useState(
        task.injectionParams?.userHeadcount ? task.injectionParams.userHeadcount.toString().replace('.', ',') : "1"
    );

    // SYNC STATE WITH PROPS (Fix for Async Persistence Loading)
    useEffect(() => {
        if (task.injectionParams?.pInyectionTime) {
            setPuInyTimeStr(task.injectionParams.pInyectionTime.toString());
        }
        if (task.injectionParams?.pCuringTime) setPuCurTimeStr(task.injectionParams.pCuringTime.toString());
        if (task.injectionParams?.manualOperations) {
            const savedOps = task.injectionParams.manualOperations;
            const currentConcurrent = projectTasks
                .filter(t => t.concurrentWith === task.id)
                .map(t => ({
                    id: t.id,
                    description: t.description,
                    time: t.standardTime || t.averageTime,
                    type: t.isMachineInternal ? 'internal' : 'external'
                } as ManualOperation));

            setManualOps([...savedOps, ...currentConcurrent]);
        }
    }, [
        task.id,
        task.injectionParams?.pInyectionTime,
        task.injectionParams?.pCuringTime,
        // Use stringify to compare content, not reference, avoiding infinite loop on inline arrays
        JSON.stringify(task.injectionParams?.manualOperations),
        JSON.stringify(projectTasks.map(t => t.id))
    ]);

    const updateHeadcount = (delta: number) => {
        const current = parseNumberInput(userHeadcountStr);
        const next = Math.max(0.1, current + delta);
        setUserHeadcountStr(next.toFixed(2).replace('.', ',').replace(',00', ''));
    };

    return {
        // Machine Params
        puInyTimeStr, setPuInyTimeStr,
        puCurTimeStr, setPuCurTimeStr,

        // Manual Ops
        manualOps, addManualOp, removeManualOp, toggleOpType,
        manualTimeOverrideStr, setManualTimeOverrideStr,

        // Cavities
        userSelectedN, setUserSelectedN,
        cavityMode, setCavityMode, updateCavities,

        // Headcount
        headcountMode, setHeadcountMode,
        userHeadcountStr, setUserHeadcountStr, updateHeadcount
    };
};
