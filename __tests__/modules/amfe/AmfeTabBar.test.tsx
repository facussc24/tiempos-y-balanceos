import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AmfeTabBar from '../../../modules/amfe/AmfeTabBar';

const defaultProps = () => ({
    activeTab: 'amfe' as 'pfd' | 'amfe' | 'controlPlan' | 'hojaOperaciones',
    onTabChange: vi.fn(),
    pfdInitialData: null,
    onGeneratePfd: vi.fn(),
    cpInitialData: null,
    hoInitialData: null,
    onGenerateControlPlan: vi.fn(),
    onGenerateHojasOperaciones: vi.fn(),
    onBackToLanding: vi.fn(),
    hasUnsavedChanges: false,
    requestConfirm: vi.fn().mockResolvedValue(true),
});

describe('AmfeTabBar', () => {
    it('renders 4 tabs in correct order', () => {
        render(<AmfeTabBar {...defaultProps()} />);

        const buttons = screen.getAllByRole('button');
        // First 4 buttons are the tabs, last one is "Inicio"
        expect(buttons[0].textContent).toContain('Diagrama de Flujo');
        expect(buttons[1].textContent).toContain('AMFE VDA');
        expect(buttons[2].textContent).toContain('Plan de Control');
        expect(buttons[3].textContent).toContain('Hojas de Operaciones');
    });

    it('clicking Diagrama de Flujo calls onGeneratePfd when pfdInitialData is null', async () => {
        const props = defaultProps();
        props.pfdInitialData = null;
        render(<AmfeTabBar {...props} />);

        fireEvent.click(screen.getByText('Diagrama de Flujo'));

        await waitFor(() => {
            expect(props.onGeneratePfd).toHaveBeenCalledTimes(1);
        });
        expect(props.onTabChange).not.toHaveBeenCalled();
    });

    it('clicking Diagrama de Flujo calls onTabChange when pfdInitialData is not null', async () => {
        const props = defaultProps();
        props.pfdInitialData = { id: 'pfd-1' } as any;
        render(<AmfeTabBar {...props} />);

        fireEvent.click(screen.getByText('Diagrama de Flujo'));

        await waitFor(() => {
            expect(props.onTabChange).toHaveBeenCalledWith('pfd');
        });
        expect(props.onGeneratePfd).not.toHaveBeenCalled();
    });

    it('PFD tab active has cyan class', () => {
        const props = defaultProps();
        props.activeTab = 'pfd';
        render(<AmfeTabBar {...props} />);

        const pfdButton = screen.getByText('Diagrama de Flujo').closest('button')!;
        expect(pfdButton.className).toContain('text-cyan-700');
    });

    it('AMFE tab active has blue class', () => {
        const props = defaultProps();
        props.activeTab = 'amfe';
        render(<AmfeTabBar {...props} />);

        const amfeButton = screen.getByText('AMFE VDA').closest('button')!;
        expect(amfeButton.className).toContain('text-blue-700');
    });

    it('clicking Plan de Control calls onGenerateControlPlan when cpInitialData is null', async () => {
        const props = defaultProps();
        props.cpInitialData = null;
        render(<AmfeTabBar {...props} />);

        fireEvent.click(screen.getByText('Plan de Control'));

        await waitFor(() => {
            expect(props.onGenerateControlPlan).toHaveBeenCalledTimes(1);
        });
        expect(props.onTabChange).not.toHaveBeenCalled();
    });

    it('clicking Plan de Control calls onTabChange when cpInitialData is not null', async () => {
        const props = defaultProps();
        props.cpInitialData = { id: 'cp-1' } as any;
        render(<AmfeTabBar {...props} />);

        fireEvent.click(screen.getByText('Plan de Control'));

        await waitFor(() => {
            expect(props.onTabChange).toHaveBeenCalledWith('controlPlan');
        });
        expect(props.onGenerateControlPlan).not.toHaveBeenCalled();
    });

    it('clicking Inicio calls onBackToLanding when no unsaved changes', async () => {
        const props = defaultProps();
        props.hasUnsavedChanges = false;
        render(<AmfeTabBar {...props} />);

        fireEvent.click(screen.getByText('Inicio'));

        await waitFor(() => {
            expect(props.onBackToLanding).toHaveBeenCalledTimes(1);
        });
        expect(props.requestConfirm).not.toHaveBeenCalled();
    });

    it('tab navigation blocked by unsaved changes until confirmed', async () => {
        const props = defaultProps();
        props.hasUnsavedChanges = true;
        props.cpInitialData = { id: 'cp-1' } as any;
        props.requestConfirm = vi.fn().mockResolvedValue(false);
        render(<AmfeTabBar {...props} />);

        fireEvent.click(screen.getByText('Plan de Control'));

        await waitFor(() => {
            expect(props.requestConfirm).toHaveBeenCalledTimes(1);
        });
        expect(props.onTabChange).not.toHaveBeenCalled();
    });

    it('all tabs present with correct text content', () => {
        render(<AmfeTabBar {...defaultProps()} />);

        expect(screen.getByText('Diagrama de Flujo')).toBeDefined();
        expect(screen.getByText('AMFE VDA')).toBeDefined();
        expect(screen.getByText('Plan de Control')).toBeDefined();
        expect(screen.getByText('Hojas de Operaciones')).toBeDefined();
        expect(screen.getByText('Inicio')).toBeDefined();
    });
});
