import { useState } from 'react';
import { ProjectData, ShiftBreak } from '../types';

export const useShiftManager = (data: ProjectData, updateData: (data: ProjectData) => void) => {
    const [editingBreaksShiftId, setEditingBreaksShiftId] = useState<number | null>(null);

    const handleShiftChange = (id: number, field: string, value: string) => {
        const newShifts = data.shifts.map((s) =>
            s.id === id ? { ...s, [field]: value } : s
        );
        updateData({ ...data, shifts: newShifts });
    };

    const addBreak = (shiftId: number) => {
        const newBreak: ShiftBreak = {
            id: Math.random().toString(36).substr(2, 9),
            name: "Descanso",
            startTime: "12:00",
            duration: 15
        };
        const updatedShifts = data.shifts.map(s =>
            s.id === shiftId ? { ...s, breaks: [...s.breaks, newBreak] } : s
        );
        updateData({ ...data, shifts: updatedShifts });
    };

    const removeBreak = (shiftId: number, breakId: string) => {
        const updatedShifts = data.shifts.map(s =>
            s.id === shiftId ? { ...s, breaks: s.breaks.filter(b => b.id !== breakId) } : s
        );
        updateData({ ...data, shifts: updatedShifts });
    };

    const updateBreak = (shiftId: number, breakId: string, field: keyof ShiftBreak, value: ShiftBreak[keyof ShiftBreak]) => {
        const updatedShifts = data.shifts.map(s =>
            s.id === shiftId ? {
                ...s,
                breaks: s.breaks.map(b => b.id === breakId ? { ...b, [field]: value } : b)
            } : s
        );
        updateData({ ...data, shifts: updatedShifts });
    };

    return {
        editingBreaksShiftId,
        setEditingBreaksShiftId,
        handleShiftChange,
        addBreak,
        removeBreak,
        updateBreak
    };
};
