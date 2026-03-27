import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SolicitudServerStatus from '../../../modules/solicitud/SolicitudServerStatus';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderStatus(overrides: Partial<React.ComponentProps<typeof SolicitudServerStatus>> = {}) {
    const defaultProps = {
        status: 'connected' as const,
        pendingOps: 0,
        onRetryPending: vi.fn(),
    };
    return render(<SolicitudServerStatus {...defaultProps} {...overrides} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SolicitudServerStatus', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows "Servidor" text and green indicator when connected', () => {
        renderStatus({ status: 'connected' });
        expect(screen.getByText('Servidor')).toBeDefined();
        // Green dot indicator exists
        const dot = document.querySelector('.bg-green-500');
        expect(dot).not.toBeNull();
    });

    it('shows "Sin conexión" text and red indicator when disconnected', () => {
        renderStatus({ status: 'disconnected' });
        expect(screen.getByText('Sin conexión')).toBeDefined();
        // Red dot indicator exists
        const dot = document.querySelector('.bg-red-500');
        expect(dot).not.toBeNull();
    });

    it('shows "Verificando..." text with spinning icon when checking', () => {
        renderStatus({ status: 'checking' });
        expect(screen.getByText('Verificando...')).toBeDefined();
        // Spinning RefreshCw icon has animate-spin class
        const spinner = document.querySelector('.animate-spin');
        expect(spinner).not.toBeNull();
        // Pulsing dot indicator
        const dot = document.querySelector('.animate-pulse');
        expect(dot).not.toBeNull();
    });

    it('shows pending ops badge when pendingOps > 0', () => {
        renderStatus({ status: 'connected', pendingOps: 3 });
        expect(screen.getByText('3')).toBeDefined();
        expect(screen.getByRole('button')).toBeDefined();
    });

    it('shows "99+" when pendingOps exceeds 99', () => {
        renderStatus({ status: 'connected', pendingOps: 150 });
        expect(screen.getByText('99+')).toBeDefined();
    });

    it('hides pending ops badge when pendingOps is 0', () => {
        renderStatus({ status: 'connected', pendingOps: 0 });
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('calls onRetryPending when pending ops badge is clicked', () => {
        const onRetryPending = vi.fn();
        renderStatus({ status: 'connected', pendingOps: 5, onRetryPending });
        fireEvent.click(screen.getByRole('button'));
        expect(onRetryPending).toHaveBeenCalledTimes(1);
    });

    it('renders correct aria-label on pending ops button', () => {
        renderStatus({ status: 'connected', pendingOps: 5 });
        const button = screen.getByRole('button');
        expect(button.getAttribute('aria-label')).toBe('5 operaciones pendientes, reintentar');
    });

    it('renders correct title tooltip on pending ops button for singular', () => {
        renderStatus({ status: 'connected', pendingOps: 1 });
        const button = screen.getByRole('button');
        expect(button.getAttribute('title')).toContain('1 operación pendiente');
    });

    it('renders correct title tooltip on pending ops button for plural', () => {
        renderStatus({ status: 'connected', pendingOps: 3 });
        const button = screen.getByRole('button');
        expect(button.getAttribute('title')).toContain('3 operaciones pendientes');
    });

    it('does not show connected indicators when status is disconnected', () => {
        renderStatus({ status: 'disconnected' });
        expect(screen.queryByText('Servidor')).toBeNull();
        expect(screen.queryByText('Verificando...')).toBeNull();
    });

    it('does not show disconnected indicators when status is connected', () => {
        renderStatus({ status: 'connected' });
        expect(screen.queryByText('Sin conexión')).toBeNull();
        expect(screen.queryByText('Verificando...')).toBeNull();
    });
});
