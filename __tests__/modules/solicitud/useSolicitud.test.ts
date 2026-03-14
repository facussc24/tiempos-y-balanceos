import { renderHook, act } from '@testing-library/react';
import { useSolicitud } from '../../../modules/solicitud/useSolicitud';
import { createEmptySolicitud } from '../../../modules/solicitud/solicitudTypes';

describe('useSolicitud', () => {
    it('initial state is a producto solicitud by default', () => {
        const { result } = renderHook(() => useSolicitud());
        expect(result.current.data.tipo).toBe('producto');
        expect(result.current.data.producto).not.toBeNull();
        expect(result.current.data.insumo).toBeNull();
    });

    it('initial state with custom data preserves it', () => {
        const custom = createEmptySolicitud('insumo');
        custom.header.solicitante = 'Carlos';
        const { result } = renderHook(() => useSolicitud(custom));
        expect(result.current.data.tipo).toBe('insumo');
        expect(result.current.data.header.solicitante).toBe('Carlos');
    });

    it('updateHeader updates only specified fields', () => {
        const { result } = renderHook(() => useSolicitud());
        act(() => {
            result.current.updateHeader({ solicitante: 'Ana' });
        });
        expect(result.current.data.header.solicitante).toBe('Ana');
        // Other header fields remain unchanged
        expect(result.current.data.header.formNumber).toBe('F-ING-001');
    });

    it('updateProducto updates producto fields', () => {
        const { result } = renderHook(() => useSolicitud());
        act(() => {
            result.current.updateProducto({ codigo: 'P-100', descripcion: 'Tuerca M6' });
        });
        expect(result.current.data.producto!.codigo).toBe('P-100');
        expect(result.current.data.producto!.descripcion).toBe('Tuerca M6');
    });

    it('updateInsumo updates insumo fields', () => {
        const insumoDoc = createEmptySolicitud('insumo');
        const { result } = renderHook(() => useSolicitud(insumoDoc));
        act(() => {
            result.current.updateInsumo({ codigo: 'I-200', unidadMedida: 'kg' });
        });
        expect(result.current.data.insumo!.codigo).toBe('I-200');
        expect(result.current.data.insumo!.unidadMedida).toBe('kg');
    });

    it('switchTipo to insumo creates insumo object and nulls producto', () => {
        const { result } = renderHook(() => useSolicitud());
        // Starts as producto
        expect(result.current.data.producto).not.toBeNull();
        act(() => {
            result.current.switchTipo('insumo');
        });
        expect(result.current.data.tipo).toBe('insumo');
        expect(result.current.data.insumo).not.toBeNull();
        expect(result.current.data.producto).toBeNull();
    });

    it('switchTipo to producto creates producto object and nulls insumo', () => {
        const insumoDoc = createEmptySolicitud('insumo');
        const { result } = renderHook(() => useSolicitud(insumoDoc));
        expect(result.current.data.insumo).not.toBeNull();
        act(() => {
            result.current.switchTipo('producto');
        });
        expect(result.current.data.tipo).toBe('producto');
        expect(result.current.data.producto).not.toBeNull();
        expect(result.current.data.insumo).toBeNull();
    });

    it('setObservaciones updates observaciones', () => {
        const { result } = renderHook(() => useSolicitud());
        act(() => {
            result.current.setObservaciones('Urgente');
        });
        expect(result.current.data.observaciones).toBe('Urgente');
    });

    it('reset creates a new empty solicitud', () => {
        const { result } = renderHook(() => useSolicitud());
        const originalId = result.current.data.id;
        act(() => {
            result.current.updateHeader({ solicitante: 'Test' });
        });
        expect(result.current.data.header.solicitante).toBe('Test');
        act(() => {
            result.current.reset();
        });
        expect(result.current.data.header.solicitante).toBe('');
        expect(result.current.data.id).not.toBe(originalId);
    });

    it('reset with custom doc sets that doc', () => {
        const { result } = renderHook(() => useSolicitud());
        const custom = createEmptySolicitud('insumo');
        custom.header.solicitante = 'Preset';
        act(() => {
            result.current.reset(custom);
        });
        expect(result.current.data.tipo).toBe('insumo');
        expect(result.current.data.header.solicitante).toBe('Preset');
        expect(result.current.data.id).toBe(custom.id);
    });

    it('updates bump updatedAt timestamp', async () => {
        const { result } = renderHook(() => useSolicitud());
        const before = result.current.data.updatedAt;
        // Small delay to ensure timestamp differs
        await new Promise(r => setTimeout(r, 10));
        act(() => {
            result.current.updateHeader({ solicitante: 'Timestamp test' });
        });
        expect(result.current.data.updatedAt).not.toBe(before);
        expect(new Date(result.current.data.updatedAt).getTime())
            .toBeGreaterThanOrEqual(new Date(before).getTime());
    });

    // --- Phase 2 methods ---

    it('setStatus updates document status', () => {
        const { result } = renderHook(() => useSolicitud());
        expect(result.current.data.status).toBe('borrador');
        act(() => {
            result.current.setStatus('enviada');
        });
        expect(result.current.data.status).toBe('enviada');
    });

    it('setStatus to obsoleta works', () => {
        const { result } = renderHook(() => useSolicitud());
        act(() => {
            result.current.setStatus('obsoleta');
        });
        expect(result.current.data.status).toBe('obsoleta');
    });

    it('updateAttachments sets attachments array', () => {
        const { result } = renderHook(() => useSolicitud());
        expect(result.current.data.attachments).toEqual([]);
        const att = [
            { fileName: 'test.pdf', fileSize: 1024, fileType: 'pdf', relativePath: 'adjuntos/test.pdf', uploadedAt: '2026-03-06T10:00:00Z', uploadedBy: 'user' },
        ];
        act(() => {
            result.current.updateAttachments(att);
        });
        expect(result.current.data.attachments).toHaveLength(1);
        expect(result.current.data.attachments[0].fileName).toBe('test.pdf');
    });

    it('setServerFolderPath updates path', () => {
        const { result } = renderHook(() => useSolicitud());
        expect(result.current.data.serverFolderPath).toBeNull();
        act(() => {
            result.current.setServerFolderPath('Y:\\Ingenieria\\Test');
        });
        expect(result.current.data.serverFolderPath).toBe('Y:\\Ingenieria\\Test');
    });

    it('setLastServerSync updates sync timestamp', () => {
        const { result } = renderHook(() => useSolicitud());
        expect(result.current.data.lastServerSync).toBeNull();
        const ts = '2026-03-06T12:00:00Z';
        act(() => {
            result.current.setLastServerSync(ts);
        });
        expect(result.current.data.lastServerSync).toBe(ts);
    });

    it('Phase 2 setters bump updatedAt', async () => {
        const { result } = renderHook(() => useSolicitud());
        const before = result.current.data.updatedAt;
        await new Promise(r => setTimeout(r, 10));
        act(() => {
            result.current.setStatus('aprobada');
        });
        expect(result.current.data.updatedAt).not.toBe(before);
    });
});
