/**
 * Tests for InheritanceBadge component
 *
 * Verifies:
 * - Correct rendering for each status (inherited, modified, own)
 * - Compact mode shows abbreviated labels
 * - Tooltip appears on hover
 * - Accessibility attributes
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { InheritanceBadge } from '../../components/ui/InheritanceBadge';
import type { InheritanceStatus } from '../../components/ui/InheritanceBadge';

describe('InheritanceBadge', () => {
    describe('status rendering', () => {
        it('renders "HEREDADO" label for inherited status', () => {
            render(<InheritanceBadge status="inherited" />);
            expect(screen.getByText('HEREDADO')).toBeTruthy();
        });

        it('renders "MODIFICADO" label for modified status', () => {
            render(<InheritanceBadge status="modified" />);
            expect(screen.getByText('MODIFICADO')).toBeTruthy();
        });

        it('renders "PROPIO" label for own status', () => {
            render(<InheritanceBadge status="own" />);
            expect(screen.getByText('PROPIO')).toBeTruthy();
        });
    });

    describe('compact mode', () => {
        it('renders abbreviated label "HER" in compact mode for inherited', () => {
            render(<InheritanceBadge status="inherited" compact />);
            expect(screen.getByText('HER')).toBeTruthy();
            expect(screen.queryByText('HEREDADO')).toBeNull();
        });

        it('renders abbreviated label "MOD" in compact mode for modified', () => {
            render(<InheritanceBadge status="modified" compact />);
            expect(screen.getByText('MOD')).toBeTruthy();
        });

        it('renders abbreviated label "PROP" in compact mode for own', () => {
            render(<InheritanceBadge status="own" compact />);
            expect(screen.getByText('PROP')).toBeTruthy();
        });
    });

    describe('accessibility', () => {
        it('has role="status" attribute', () => {
            render(<InheritanceBadge status="inherited" />);
            expect(screen.getByRole('status')).toBeTruthy();
        });

        it('has appropriate aria-label for inherited status', () => {
            render(<InheritanceBadge status="inherited" />);
            const badge = screen.getByRole('status');
            expect(badge.getAttribute('aria-label')).toBeTruthy();
            expect(badge.getAttribute('aria-label')).toContain('maestro');
        });

        it('has appropriate aria-label for modified status', () => {
            render(<InheritanceBadge status="modified" />);
            const badge = screen.getByRole('status');
            expect(badge.getAttribute('aria-label')).toContain('modificado');
        });

        it('has appropriate aria-label for own status', () => {
            render(<InheritanceBadge status="own" />);
            const badge = screen.getByRole('status');
            expect(badge.getAttribute('aria-label')).toContain('variante');
        });
    });

    describe('styling', () => {
        it('applies slate colors for inherited status', () => {
            render(<InheritanceBadge status="inherited" />);
            const badge = screen.getByRole('status');
            expect(badge.className).toContain('bg-slate-100');
            expect(badge.className).toContain('text-slate-600');
        });

        it('applies amber colors for modified status', () => {
            render(<InheritanceBadge status="modified" />);
            const badge = screen.getByRole('status');
            expect(badge.className).toContain('bg-amber-50');
            expect(badge.className).toContain('text-amber-700');
        });

        it('applies blue colors for own status', () => {
            render(<InheritanceBadge status="own" />);
            const badge = screen.getByRole('status');
            expect(badge.className).toContain('bg-blue-50');
            expect(badge.className).toContain('text-blue-700');
        });

        it('passes through additional className', () => {
            render(<InheritanceBadge status="inherited" className="mt-2" />);
            const badge = screen.getByRole('status');
            expect(badge.className).toContain('mt-2');
        });
    });

    describe('tooltip', () => {
        it('shows tooltip on mouse enter', async () => {
            render(<InheritanceBadge status="inherited" />);
            const badge = screen.getByRole('status');

            act(() => {
                fireEvent.mouseEnter(badge);
            });

            // Tooltip should be rendered via portal
            const tooltip = document.querySelector('[role="tooltip"]');
            expect(tooltip).not.toBeNull();
            expect(tooltip?.textContent).toContain('maestro');
        });

        it('hides tooltip on mouse leave', async () => {
            render(<InheritanceBadge status="inherited" />);
            const badge = screen.getByRole('status');

            act(() => {
                fireEvent.mouseEnter(badge);
            });
            expect(document.querySelector('[role="tooltip"]')).not.toBeNull();

            act(() => {
                fireEvent.mouseLeave(badge);
            });
            expect(document.querySelector('[role="tooltip"]')).toBeNull();
        });
    });

    describe('all statuses', () => {
        const statuses: InheritanceStatus[] = ['inherited', 'modified', 'own'];

        it.each(statuses)('renders without crashing for status "%s"', (status) => {
            const { container } = render(<InheritanceBadge status={status} />);
            expect(container.firstChild).not.toBeNull();
        });

        it.each(statuses)('renders compact mode without crashing for status "%s"', (status) => {
            const { container } = render(<InheritanceBadge status={status} compact />);
            expect(container.firstChild).not.toBeNull();
        });
    });
});
