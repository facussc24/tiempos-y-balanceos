import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AmfeTabBar from '../../../modules/amfe/AmfeTabBar';
import type { ControlPlanDocument } from '../../../modules/controlPlan/controlPlanTypes';

const defaultProps = () => ({
    activeTab: 'amfe' as 'amfe' | 'controlPlan',
    onTabChange: vi.fn(),
    cpInitialData: null as ControlPlanDocument | null,
    onBackToLanding: vi.fn(),
    hasUnsavedChanges: false,
    requestConfirm: vi.fn().mockResolvedValue(true),
});

describe('AmfeTabBar', () => {
    it('renders 2 tabs in correct order', () => {
        render(<AmfeTabBar {...defaultProps()} />);

        const buttons = screen.getAllByRole('button');
        // First 2 buttons are the tabs, last one is "Inicio"
        expect(buttons[0].textContent).toContain('AMFE VDA');
        expect(buttons[1].textContent).toContain('Plan de Control');
    });

    it('AMFE tab active has blue class', () => {
        const props = defaultProps();
        props.activeTab = 'amfe';
        render(<AmfeTabBar {...props} />);

        const amfeButton = screen.getByText('AMFE VDA').closest('button')!;
        expect(amfeButton.className).toContain('text-blue-700');
    });

    it('Control Plan tab active has green class', () => {
        const props = defaultProps();
        props.activeTab = 'controlPlan';
        render(<AmfeTabBar {...props} />);

        const cpButton = screen.getByText('Plan de Control').closest('button')!;
        expect(cpButton.className).toContain('text-green-700');
    });

    it('clicking Plan de Control calls onTabChange when cpInitialData is null (CP module handles draft recovery)', async () => {
        const props = defaultProps();
        props.cpInitialData = null;
        render(<AmfeTabBar {...props} />);

        fireEvent.click(screen.getByText('Plan de Control'));

        await waitFor(() => {
            expect(props.onTabChange).toHaveBeenCalledWith('controlPlan');
        });
    });

    it('clicking Plan de Control calls onTabChange when cpInitialData is not null', async () => {
        const props = defaultProps();
        props.cpInitialData = { id: 'cp-1' } as unknown as ControlPlanDocument;
        render(<AmfeTabBar {...props} />);

        fireEvent.click(screen.getByText('Plan de Control'));

        await waitFor(() => {
            expect(props.onTabChange).toHaveBeenCalledWith('controlPlan');
        });
    });

    it('shows "Guardado" badge when a CP is linked', () => {
        const props = defaultProps();
        props.cpInitialData = { id: 'cp-1' } as unknown as ControlPlanDocument;
        render(<AmfeTabBar {...props} />);

        expect(screen.getByText('Guardado')).toBeDefined();
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
        props.cpInitialData = { id: 'cp-1' } as unknown as ControlPlanDocument;
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

        expect(screen.getByText('AMFE VDA')).toBeDefined();
        expect(screen.getByText('Plan de Control')).toBeDefined();
        expect(screen.getByText('Inicio')).toBeDefined();
    });
});
