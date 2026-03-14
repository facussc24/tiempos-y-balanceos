/**
 * Solicitud State Management Hook
 *
 * Simple state management for the solicitud form.
 */

import { useState, useCallback } from 'react';
import type { SolicitudDocument, SolicitudTipo, SolicitudStatus, SolicitudHeader, SolicitudProducto, SolicitudInsumo, SolicitudAttachment } from './solicitudTypes';
import { createEmptySolicitud } from './solicitudTypes';

export interface UseSolicitudResult {
    data: SolicitudDocument;
    updateHeader: (partial: Partial<SolicitudHeader>) => void;
    updateProducto: (partial: Partial<SolicitudProducto>) => void;
    updateInsumo: (partial: Partial<SolicitudInsumo>) => void;
    switchTipo: (tipo: SolicitudTipo) => void;
    setObservaciones: (text: string) => void;
    setStatus: (status: SolicitudStatus) => void;
    updateAttachments: (attachments: SolicitudAttachment[]) => void;
    setServerFolderPath: (path: string | null) => void;
    setLastServerSync: (ts: string | null) => void;
    reset: (doc?: SolicitudDocument) => void;
    setData: (doc: SolicitudDocument) => void;
}

export function useSolicitud(initialData?: SolicitudDocument): UseSolicitudResult {
    const [data, setDataState] = useState<SolicitudDocument>(
        initialData ?? createEmptySolicitud()
    );

    const updateHeader = useCallback((partial: Partial<SolicitudHeader>) => {
        setDataState(prev => ({
            ...prev,
            header: { ...prev.header, ...partial },
            updatedAt: new Date().toISOString(),
        }));
    }, []);

    const updateProducto = useCallback((partial: Partial<SolicitudProducto>) => {
        setDataState(prev => ({
            ...prev,
            producto: prev.producto ? { ...prev.producto, ...partial } : null,
            updatedAt: new Date().toISOString(),
        }));
    }, []);

    const updateInsumo = useCallback((partial: Partial<SolicitudInsumo>) => {
        setDataState(prev => ({
            ...prev,
            insumo: prev.insumo ? { ...prev.insumo, ...partial } : null,
            updatedAt: new Date().toISOString(),
        }));
    }, []);

    const switchTipo = useCallback((tipo: SolicitudTipo) => {
        setDataState(prev => ({
            ...prev,
            tipo,
            producto: tipo === 'producto' ? { codigo: '', descripcion: '', cliente: '' } : null,
            insumo: tipo === 'insumo'
                ? { codigo: '', descripcion: '', unidadMedida: 'un' as const, requiereGeneracionInterna: false }
                : null,
            updatedAt: new Date().toISOString(),
        }));
    }, []);

    const setObservaciones = useCallback((text: string) => {
        setDataState(prev => ({ ...prev, observaciones: text, updatedAt: new Date().toISOString() }));
    }, []);

    const setStatus = useCallback((status: SolicitudStatus) => {
        setDataState(prev => ({ ...prev, status, updatedAt: new Date().toISOString() }));
    }, []);

    const updateAttachments = useCallback((attachments: SolicitudAttachment[]) => {
        setDataState(prev => ({ ...prev, attachments, updatedAt: new Date().toISOString() }));
    }, []);

    const setServerFolderPath = useCallback((path: string | null) => {
        setDataState(prev => ({ ...prev, serverFolderPath: path, updatedAt: new Date().toISOString() }));
    }, []);

    const setLastServerSync = useCallback((ts: string | null) => {
        setDataState(prev => ({ ...prev, lastServerSync: ts, updatedAt: new Date().toISOString() }));
    }, []);

    const reset = useCallback((doc?: SolicitudDocument) => {
        setDataState(doc ?? createEmptySolicitud());
    }, []);

    return {
        data,
        updateHeader,
        updateProducto,
        updateInsumo,
        switchTipo,
        setObservaciones,
        setStatus,
        updateAttachments,
        setServerFolderPath,
        setLastServerSync,
        reset,
        setData: setDataState,
    };
}
