/**
 * Tests for ProductSelector component
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ProductSelector from '../../components/ui/ProductSelector';

// Mock the hook
const mockResults = [
    { id: 1, codigo: '40-12825', descripcion: 'CONJ. PAÑO D/I PVC JET BLACK', lineaCode: '012', lineaName: 'LEQUIPE', active: true, createdAt: '', updatedAt: '' },
    { id: 2, codigo: '40-12826', descripcion: 'CONJ. PAÑO D/D PVC JET BLACK', lineaCode: '012', lineaName: 'LEQUIPE', active: true, createdAt: '', updatedAt: '' },
    { id: 3, codigo: 'TR-501', descripcion: 'PARAGOLPES DELANTERO', lineaCode: '020', lineaName: 'PWA', active: true, createdAt: '', updatedAt: '' },
];

const mockCustomerLines = [
    { id: 1, code: '012', name: 'LEQUIPE', productCount: 29, isAutomotive: true, active: true, createdAt: '' },
    { id: 2, code: '020', name: 'PWA', productCount: 165, isAutomotive: true, active: true, createdAt: '' },
];

let hookState = {
    query: '',
    results: mockResults as typeof mockResults,
    isLoading: false,
    customerLines: mockCustomerLines,
    selectedLine: '',
};

const mockSetQuery = vi.fn((q: string) => { hookState.query = q; });
const mockSetSelectedLine = vi.fn();
const mockClearSearch = vi.fn();

vi.mock('../../hooks/useProductSearch', () => ({
    useProductSearch: () => ({
        query: hookState.query,
        setQuery: mockSetQuery,
        results: hookState.results,
        isLoading: hookState.isLoading,
        customerLines: hookState.customerLines,
        selectedLine: hookState.selectedLine,
        setSelectedLine: mockSetSelectedLine,
        clearSearch: mockClearSearch,
    }),
}));

describe('ProductSelector', () => {
    const defaultProps = {
        value: '',
        onProductSelect: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        hookState = {
            query: '',
            results: mockResults,
            isLoading: false,
            customerLines: mockCustomerLines,
            selectedLine: '',
        };
    });

    it('renders input with placeholder', () => {
        render(<ProductSelector {...defaultProps} placeholder="Buscar producto..." />);
        expect(screen.getByPlaceholderText('Buscar producto...')).toBeDefined();
    });

    it('renders with value', () => {
        render(<ProductSelector {...defaultProps} value="40-12825" />);
        const input = screen.getByRole('combobox') as HTMLInputElement;
        expect(input.value).toBe('40-12825');
    });

    it('has combobox role', () => {
        render(<ProductSelector {...defaultProps} />);
        const input = screen.getByRole('combobox');
        expect(input).toBeDefined();
    });

    it('has aria-autocomplete attribute', () => {
        render(<ProductSelector {...defaultProps} />);
        const input = screen.getByRole('combobox');
        expect(input.getAttribute('aria-autocomplete')).toBe('list');
    });

    it('has aria-expanded false by default', () => {
        render(<ProductSelector {...defaultProps} />);
        const input = screen.getByRole('combobox');
        expect(input.getAttribute('aria-expanded')).toBe('false');
    });

    it('renders search button', () => {
        render(<ProductSelector {...defaultProps} />);
        const btn = screen.getByLabelText('Buscar producto');
        expect(btn).toBeDefined();
    });

    it('does not render search button when readOnly', () => {
        render(<ProductSelector {...defaultProps} readOnly />);
        expect(screen.queryByLabelText('Buscar producto')).toBeNull();
    });

    it('applies readOnly to input', () => {
        render(<ProductSelector {...defaultProps} readOnly />);
        const input = screen.getByRole('combobox') as HTMLInputElement;
        expect(input.readOnly).toBe(true);
    });

    it('shows clear button when value exists', () => {
        render(<ProductSelector {...defaultProps} value="test" />);
        expect(screen.getByLabelText('Limpiar selección')).toBeDefined();
    });

    it('does not show clear button when value is empty', () => {
        render(<ProductSelector {...defaultProps} value="" />);
        expect(screen.queryByLabelText('Limpiar selección')).toBeNull();
    });

    it('calls onTextChange on input change', () => {
        const onTextChange = vi.fn();
        render(<ProductSelector {...defaultProps} onTextChange={onTextChange} />);
        const input = screen.getByRole('combobox');
        fireEvent.change(input, { target: { value: '40-' } });
        expect(onTextChange).toHaveBeenCalledWith('40-');
        expect(mockSetQuery).toHaveBeenCalledWith('40-');
    });

    it('respects maxLength', () => {
        render(<ProductSelector {...defaultProps} maxLength={10} />);
        const input = screen.getByRole('combobox');
        expect(input.getAttribute('maxLength')).toBe('10');
    });

    it('renders name attribute', () => {
        render(<ProductSelector {...defaultProps} name="partNumber" />);
        const input = screen.getByRole('combobox');
        expect(input.getAttribute('name')).toBe('partNumber');
    });

    it('calls clearSearch when clear button clicked', () => {
        const onTextChange = vi.fn();
        render(<ProductSelector {...defaultProps} value="test" onTextChange={onTextChange} />);
        fireEvent.click(screen.getByLabelText('Limpiar selección'));
        expect(mockClearSearch).toHaveBeenCalled();
        expect(onTextChange).toHaveBeenCalledWith('');
    });

    it('handles Escape key without crashing', () => {
        render(<ProductSelector {...defaultProps} />);
        const input = screen.getByRole('combobox');
        fireEvent.keyDown(input, { key: 'Escape' });
        expect(input).toBeDefined();
    });

    it('handles Tab key without crashing', () => {
        render(<ProductSelector {...defaultProps} />);
        const input = screen.getByRole('combobox');
        fireEvent.keyDown(input, { key: 'Tab' });
        expect(input).toBeDefined();
    });

    it('passes custom className to wrapper', () => {
        const { container } = render(<ProductSelector {...defaultProps} className="my-custom-class" />);
        expect((container.firstChild as HTMLElement).className).toContain('my-custom-class');
    });

    it('does not crash with empty results', () => {
        hookState.results = [];
        render(<ProductSelector {...defaultProps} />);
        expect(screen.getByRole('combobox')).toBeDefined();
    });

    it('renders correctly with loading state', () => {
        hookState.isLoading = true;
        hookState.results = [];
        render(<ProductSelector {...defaultProps} />);
        expect(screen.getByRole('combobox')).toBeDefined();
    });

    it('uses default Spanish placeholder', () => {
        render(<ProductSelector {...defaultProps} />);
        expect(screen.getByPlaceholderText('Buscar por código o descripción...')).toBeDefined();
    });

    it('does not show clear button in readOnly mode even with value', () => {
        render(<ProductSelector {...defaultProps} value="test" readOnly />);
        expect(screen.queryByLabelText('Limpiar selección')).toBeNull();
    });
});
