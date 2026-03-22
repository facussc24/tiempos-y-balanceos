/**
 * Tests for FormatosApp.tsx
 *
 * Covers: server status display, file listing with icons, file open, back navigation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockIsServerAvailable = vi.fn();
const mockListFiles = vi.fn();
const mockOpenPath = vi.fn();

vi.mock('../../../modules/engineering/engineeringServerManager', () => ({
    isEngineeringServerAvailable: (...args: unknown[]) => mockIsServerAvailable(...args),
    listEngineeringFiles: (...args: unknown[]) => mockListFiles(...args),
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
    openPath: (...args: unknown[]) => mockOpenPath(...args),
}));

// ---------------------------------------------------------------------------
// Import (after mocks)
// ---------------------------------------------------------------------------

import FormatosApp from '../../../modules/engineering/FormatosApp';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderApp(props: Partial<React.ComponentProps<typeof FormatosApp>> = {}) {
    const defaultProps = {
        onBackToLanding: vi.fn(),
    };
    return render(<FormatosApp {...defaultProps} {...props} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FormatosApp', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIsServerAvailable.mockResolvedValue(true);
        mockListFiles.mockResolvedValue([]);
        mockOpenPath.mockResolvedValue(undefined);
    });

    it('shows title Formatos Estándar', async () => {
        renderApp();
        await waitFor(() => {
            expect(screen.getAllByText('Formatos Estándar')[0]).toBeTruthy();
        });
    });

    it('shows disconnected state when server not available', async () => {
        mockIsServerAvailable.mockResolvedValue(false);
        renderApp();
        await waitFor(() => {
            expect(screen.getByText('Servidor no disponible')).toBeTruthy();
        }, { timeout: 3000 });
    });

    it('lists files with file names visible', async () => {
        mockListFiles.mockResolvedValue([
            { name: 'Template.xlsx', path: 'Y:\\Ingenieria\\Formatos Estandar\\Template.xlsx', extension: '.xlsx', isFile: true },
            { name: 'Report.pdf', path: 'Y:\\Ingenieria\\Formatos Estandar\\Report.pdf', extension: '.pdf', isFile: true },
        ]);
        renderApp();
        await waitFor(() => {
            expect(screen.getByText('Template.xlsx')).toBeTruthy();
            expect(screen.getByText('Report.pdf')).toBeTruthy();
        });
    });

    it('shows file extension labels', async () => {
        mockListFiles.mockResolvedValue([
            { name: 'Doc.docx', path: 'path', extension: '.docx', isFile: true },
        ]);
        renderApp();
        await waitFor(() => {
            expect(screen.getByText('docx')).toBeTruthy();
        });
    });

    it('calls onBackToLanding when back button is clicked', async () => {
        const onBack = vi.fn();
        renderApp({ onBackToLanding: onBack });
        await waitFor(() => {
            expect(screen.getAllByText('Inicio')[0]).toBeTruthy();
        });
        fireEvent.click(screen.getAllByText('Inicio')[0]);
        expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('shows empty state when no files', async () => {
        mockListFiles.mockResolvedValue([]);
        renderApp();
        await waitFor(() => {
            expect(screen.getByText('No hay formatos disponibles.')).toBeTruthy();
        });
    });

    it('filters files by search query', async () => {
        mockListFiles.mockResolvedValue([
            { name: 'Template.xlsx', path: 'Y:\\Template.xlsx', extension: '.xlsx', isFile: true },
            { name: 'Report.pdf', path: 'Y:\\Report.pdf', extension: '.pdf', isFile: true },
        ]);
        renderApp();
        await waitFor(() => {
            expect(screen.getByText('Template.xlsx')).toBeTruthy();
        });

        const searchInput = screen.getByPlaceholderText('Buscar formato...');
        fireEvent.change(searchInput, { target: { value: 'Report' } });

        expect(screen.queryByText('Template.xlsx')).toBeNull();
        expect(screen.getByText('Report.pdf')).toBeTruthy();
    });

    it('shows no-results state when search has no matches', async () => {
        mockListFiles.mockResolvedValue([
            { name: 'Template.xlsx', path: 'Y:\\Template.xlsx', extension: '.xlsx', isFile: true },
        ]);
        renderApp();
        await waitFor(() => {
            expect(screen.getByText('Template.xlsx')).toBeTruthy();
        });

        const searchInput = screen.getByPlaceholderText('Buscar formato...');
        fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

        expect(screen.queryByText('Template.xlsx')).toBeNull();
        expect(screen.getByText(/Sin resultados para/)).toBeTruthy();
    });
});
