/**
 * Tests for productRepository
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database
const mockSelect = vi.fn();
const mockExecute = vi.fn();
vi.mock('../../../utils/database', () => ({
    getDatabase: vi.fn(() => Promise.resolve({
        select: mockSelect,
        execute: mockExecute,
    })),
}));

vi.mock('../../../utils/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

import {
    getProductCount,
    listProducts,
    getProductByCode,
    searchProducts,
    upsertProduct,
    listCustomerLines,
    getProductsByLine,
    isProductCatalogSeeded,
    seedProductCatalog,
} from '../../../utils/repositories/productRepository';

beforeEach(() => {
    vi.clearAllMocks();
});

describe('productRepository', () => {
    describe('getProductCount', () => {
        it('should return count from database', async () => {
            mockSelect.mockResolvedValue([{ cnt: 42 }]);
            const count = await getProductCount();
            expect(count).toBe(42);
            expect(mockSelect).toHaveBeenCalledWith('SELECT COUNT(*) as cnt FROM products');
        });

        it('should return 0 when no rows', async () => {
            mockSelect.mockResolvedValue([]);
            const count = await getProductCount();
            expect(count).toBe(0);
        });
    });

    describe('listProducts', () => {
        it('should list all active products by default', async () => {
            mockSelect.mockResolvedValue([
                { id: 1, codigo: 'ABC', descripcion: 'Test', linea_code: '095', linea_name: 'VW', active: 1, created_at: '', updated_at: '' },
            ]);
            const products = await listProducts();
            expect(products).toHaveLength(1);
            expect(products[0].codigo).toBe('ABC');
            expect(products[0].active).toBe(true);
            expect(mockSelect.mock.calls[0][0]).toContain('active = 1');
        });

        it('should filter by linea code', async () => {
            mockSelect.mockResolvedValue([]);
            await listProducts({ lineaCode: '095' });
            expect(mockSelect.mock.calls[0][0]).toContain('linea_code = ?');
            expect(mockSelect.mock.calls[0][1]).toContain('095');
        });

        it('should search by text', async () => {
            mockSelect.mockResolvedValue([]);
            await listProducts({ search: 'PAÑO' });
            expect(mockSelect.mock.calls[0][0]).toContain('codigo LIKE ?');
            expect(mockSelect.mock.calls[0][0]).toContain('descripcion LIKE ?');
            expect(mockSelect.mock.calls[0][1]).toContain('%PAÑO%');
        });

        it('should support limit and offset', async () => {
            mockSelect.mockResolvedValue([]);
            await listProducts({ limit: 10, offset: 20 });
            expect(mockSelect.mock.calls[0][0]).toContain('LIMIT 10');
            expect(mockSelect.mock.calls[0][0]).toContain('OFFSET 20');
        });
    });

    describe('getProductByCode', () => {
        it('should return product when found', async () => {
            mockSelect.mockResolvedValue([
                { id: 1, codigo: '40-12825', descripcion: 'PAÑO D/I', linea_code: '012', linea_name: 'LEQUIPE', active: 1, created_at: '', updated_at: '' },
            ]);
            const product = await getProductByCode('40-12825', '012');
            expect(product).not.toBeNull();
            expect(product!.codigo).toBe('40-12825');
            expect(product!.lineaCode).toBe('012');
        });

        it('should return null when not found', async () => {
            mockSelect.mockResolvedValue([]);
            const product = await getProductByCode('NOPE', '000');
            expect(product).toBeNull();
        });
    });

    describe('searchProducts', () => {
        it('should search with LIKE pattern', async () => {
            mockSelect.mockResolvedValue([]);
            await searchProducts('INSERT');
            expect(mockSelect.mock.calls[0][1]).toEqual(['%INSERT%', '%INSERT%', 50]);
        });

        it('should respect custom limit', async () => {
            mockSelect.mockResolvedValue([]);
            await searchProducts('VW', 10);
            expect(mockSelect.mock.calls[0][1]).toEqual(['%VW%', '%VW%', 10]);
        });
    });

    describe('upsertProduct', () => {
        it('should execute INSERT OR REPLACE', async () => {
            mockExecute.mockResolvedValue({ rowsAffected: 1, lastInsertId: 1 });
            await upsertProduct({
                codigo: 'NEW-001',
                descripcion: 'New Product',
                lineaCode: '095',
                lineaName: 'VOLKSWAGEN',
            });
            expect(mockExecute).toHaveBeenCalledTimes(1);
            expect(mockExecute.mock.calls[0][0]).toContain('INSERT OR REPLACE');
            expect(mockExecute.mock.calls[0][1]).toEqual(['NEW-001', 'New Product', '095', 'VOLKSWAGEN']);
        });
    });

    describe('listCustomerLines', () => {
        it('should list all active lines by default', async () => {
            mockSelect.mockResolvedValue([
                { id: 1, code: '095', name: 'VOLKSWAGEN', product_count: 122, is_automotive: 1, active: 1, created_at: '' },
            ]);
            const lines = await listCustomerLines();
            expect(lines).toHaveLength(1);
            expect(lines[0].code).toBe('095');
            expect(lines[0].isAutomotive).toBe(true);
        });

        it('should filter automotive only', async () => {
            mockSelect.mockResolvedValue([]);
            await listCustomerLines({ automotiveOnly: true });
            expect(mockSelect.mock.calls[0][0]).toContain('is_automotive = 1');
        });
    });

    describe('getProductsByLine', () => {
        it('should delegate to listProducts with lineaCode', async () => {
            mockSelect.mockResolvedValue([]);
            await getProductsByLine('020');
            expect(mockSelect.mock.calls[0][0]).toContain('linea_code = ?');
            expect(mockSelect.mock.calls[0][1]).toContain('020');
        });
    });

    describe('isProductCatalogSeeded', () => {
        it('should return true when products exist', async () => {
            mockSelect.mockResolvedValue([{ cnt: 100 }]);
            expect(await isProductCatalogSeeded()).toBe(true);
        });

        it('should return false when no products', async () => {
            mockSelect.mockResolvedValue([{ cnt: 0 }]);
            expect(await isProductCatalogSeeded()).toBe(false);
        });
    });

    describe('seedProductCatalog', () => {
        it('should skip if already seeded', async () => {
            mockSelect.mockResolvedValue([{ cnt: 500 }]);
            const result = await seedProductCatalog(
                [{ codigo: 'A', descripcion: 'B', lineaCode: 'C', lineaName: 'D' }],
                [{ code: 'C', name: 'D', productCount: 1, isAutomotive: false }]
            );
            expect(result.productsInserted).toBe(0);
            expect(result.linesInserted).toBe(0);
            expect(mockExecute).not.toHaveBeenCalled();
        });

        it('should insert products and lines when empty', async () => {
            mockSelect.mockResolvedValue([{ cnt: 0 }]);
            mockExecute.mockResolvedValue({ rowsAffected: 1, lastInsertId: 1 });

            const result = await seedProductCatalog(
                [
                    { codigo: 'P1', descripcion: 'Product 1', lineaCode: 'L1', lineaName: 'Line 1' },
                    { codigo: 'P2', descripcion: 'Product 2', lineaCode: 'L1', lineaName: 'Line 1' },
                ],
                [{ code: 'L1', name: 'Line 1', productCount: 2, isAutomotive: true }]
            );

            expect(result.productsInserted).toBe(2);
            expect(result.linesInserted).toBe(1);
            // 1 line insert + 2 product inserts = 3 execute calls
            expect(mockExecute).toHaveBeenCalledTimes(3);
        });

        it('should handle individual insert failures gracefully', async () => {
            mockSelect.mockResolvedValue([{ cnt: 0 }]);
            mockExecute
                .mockResolvedValueOnce({ rowsAffected: 1, lastInsertId: 1 }) // line
                .mockResolvedValueOnce({ rowsAffected: 1, lastInsertId: 1 }) // product 1
                .mockRejectedValueOnce(new Error('duplicate')); // product 2 fails

            const result = await seedProductCatalog(
                [
                    { codigo: 'P1', descripcion: 'Product 1', lineaCode: 'L1', lineaName: 'Line 1' },
                    { codigo: 'P2', descripcion: 'Product 2', lineaCode: 'L1', lineaName: 'Line 1' },
                ],
                [{ code: 'L1', name: 'Line 1', productCount: 2, isAutomotive: false }]
            );

            // Second product failed so only 1 is counted
            expect(result.linesInserted).toBe(1);
            expect(result.productsInserted).toBe(1);
        });
    });
});
