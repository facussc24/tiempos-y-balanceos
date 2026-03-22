/**
 * Tests for ManualesApp.tsx
 *
 * Covers: server status display, file listing, HTML rendering, external open, back navigation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockIsServerAvailable = vi.fn();
const mockListFiles = vi.fn();
const mockReadHtml = vi.fn();
const mockOpenPath = vi.fn();

vi.mock('../../../modules/engineering/engineeringServerManager', () => ({
    isEngineeringServerAvailable: (...args: unknown[]) => mockIsServerAvailable(...args),
    listEngineeringFiles: (...args: unknown[]) => mockListFiles(...args),
    readManualHtml: (...args: unknown[]) => mockReadHtml(...args),
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
    openPath: (...args: unknown[]) => mockOpenPath(...args),
}));

// ---------------------------------------------------------------------------
// Import (after mocks)
// ---------------------------------------------------------------------------

import ManualesApp from '../../../modules/engineering/ManualesApp';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderApp(props: Partial<React.ComponentProps<typeof ManualesApp>> = {}) {
    const defaultProps = {
        onBackToLanding: vi.fn(),
    };
    return render(<ManualesApp {...defaultProps} {...props} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ManualesApp', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIsServerAvailable.mockResolvedValue(true);
        mockListFiles.mockResolvedValue([]);
        mockReadHtml.mockResolvedValue(null);
        mockOpenPath.mockResolvedValue(undefined);
    });

    it('shows title Manuales de Ingeniería', async () => {
        renderApp();
        await waitFor(() => {
            expect(screen.getByText('Manuales de Ingeniería')).toBeTruthy();
        });
    });

    it('shows disconnected state when server not available', async () => {
        mockIsServerAvailable.mockResolvedValue(false);
        renderApp();
        await waitFor(() => {
            expect(screen.getByText('Servidor no disponible')).toBeTruthy();
        }, { timeout: 3000 });
    });

    it('lists files when server is connected', async () => {
        mockListFiles.mockResolvedValue([
            { name: 'P-ING-001_Procedimiento.html', path: 'Y:\\Ingenieria\\Manuales\\P-ING-001_Procedimiento.html', extension: '.html', isFile: true },
        ]);
        renderApp();
        await waitFor(() => {
            expect(screen.getByText('P-ING-001_Procedimiento.html')).toBeTruthy();
        });
    });

    it('renders HTML content when a file is selected', async () => {
        mockListFiles.mockResolvedValue([
            { name: 'test.html', path: 'Y:\\test.html', extension: '.html', isFile: true },
        ]);
        mockReadHtml.mockResolvedValue('<h1>Hello World</h1>');

        renderApp();

        await waitFor(() => {
            expect(screen.getByText('test.html')).toBeTruthy();
        });

        fireEvent.click(screen.getByText('test.html'));

        await waitFor(() => {
            expect(screen.getByText('Hello World')).toBeTruthy();
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

    it('shows empty state when no files available', async () => {
        mockListFiles.mockResolvedValue([]);
        renderApp();
        await waitFor(() => {
            expect(screen.getByText('No hay manuales disponibles.')).toBeTruthy();
        });
    });

    it('filters files by search query', async () => {
        mockListFiles.mockResolvedValue([
            { name: 'P-ING-001_Manual.html', path: 'Y:\\P-ING-001.html', extension: '.html', isFile: true },
            { name: 'P-ING-002_Guia.html', path: 'Y:\\P-ING-002.html', extension: '.html', isFile: true },
        ]);
        renderApp();
        await waitFor(() => {
            expect(screen.getByText('P-ING-001_Manual.html')).toBeTruthy();
        });

        const searchInput = screen.getByPlaceholderText('Buscar manual...');
        fireEvent.change(searchInput, { target: { value: 'Guia' } });

        expect(screen.queryByText('P-ING-001_Manual.html')).toBeNull();
        expect(screen.getByText('P-ING-002_Guia.html')).toBeTruthy();
    });

    it('shows no-results state when search has no matches', async () => {
        mockListFiles.mockResolvedValue([
            { name: 'P-ING-001_Manual.html', path: 'Y:\\P-ING-001.html', extension: '.html', isFile: true },
        ]);
        renderApp();
        await waitFor(() => {
            expect(screen.getByText('P-ING-001_Manual.html')).toBeTruthy();
        });

        const searchInput = screen.getByPlaceholderText('Buscar manual...');
        fireEvent.change(searchInput, { target: { value: 'xyz' } });

        expect(screen.queryByText('P-ING-001_Manual.html')).toBeNull();
        expect(screen.getByText(/Sin resultados para/)).toBeTruthy();
    });
});
