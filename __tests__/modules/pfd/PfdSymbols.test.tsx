import React from 'react';
import { render, screen } from '@testing-library/react';
import {
    OperationSymbol, TransportSymbol, InspectionSymbol,
    StorageSymbol, DelaySymbol, DecisionSymbol, CombinedSymbol,
    PfdSymbol,
} from '../../../modules/pfd/PfdSymbols';

describe('PfdSymbols', () => {
    it('should render OperationSymbol', () => {
        const { container } = render(<OperationSymbol />);
        expect(container.querySelector('svg')).toBeTruthy();
        expect(container.querySelector('circle')).toBeTruthy();
    });

    it('should render TransportSymbol', () => {
        const { container } = render(<TransportSymbol />);
        expect(container.querySelector('svg')).toBeTruthy();
        expect(container.querySelector('path')).toBeTruthy();
    });

    it('should render InspectionSymbol', () => {
        const { container } = render(<InspectionSymbol />);
        expect(container.querySelector('svg')).toBeTruthy();
        expect(container.querySelector('rect')).toBeTruthy();
    });

    it('should render StorageSymbol', () => {
        const { container } = render(<StorageSymbol />);
        expect(container.querySelector('svg')).toBeTruthy();
        expect(container.querySelector('polygon')).toBeTruthy();
    });

    it('should render DelaySymbol', () => {
        const { container } = render(<DelaySymbol />);
        expect(container.querySelector('svg')).toBeTruthy();
    });

    it('should render DecisionSymbol', () => {
        const { container } = render(<DecisionSymbol />);
        expect(container.querySelector('svg')).toBeTruthy();
        expect(container.querySelector('polygon')).toBeTruthy();
    });

    it('should render CombinedSymbol', () => {
        const { container } = render(<CombinedSymbol />);
        expect(container.querySelector('svg')).toBeTruthy();
        expect(container.querySelector('rect')).toBeTruthy();
        expect(container.querySelector('circle')).toBeTruthy();
    });

    it('should have correct aria-labels', () => {
        render(<OperationSymbol />);
        expect(screen.getByLabelText('Operación')).toBeTruthy();
    });

    it('should accept custom size', () => {
        const { container } = render(<OperationSymbol size={32} />);
        const svg = container.querySelector('svg');
        expect(svg?.getAttribute('width')).toBe('32');
        expect(svg?.getAttribute('height')).toBe('32');
    });

    describe('PfdSymbol dispatcher', () => {
        it('should render correct symbol for each type', () => {
            const types = ['operation', 'transport', 'inspection', 'storage', 'delay', 'decision', 'combined'];
            for (const type of types) {
                const { container } = render(<PfdSymbol type={type} />);
                expect(container.querySelector('svg')).toBeTruthy();
            }
        });

        it('should return null for unknown type', () => {
            const { container } = render(<PfdSymbol type="unknown" />);
            expect(container.querySelector('svg')).toBeNull();
        });
    });
});
