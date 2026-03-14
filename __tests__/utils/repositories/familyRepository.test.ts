/**
 * Tests for familyRepository
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
    listFamilies,
    getFamilyById,
    getFamilyByName,
    createFamily,
    updateFamily,
    deleteFamily,
    getFamilyCount,
    getFamilyMembers,
    addFamilyMember,
    removeFamilyMember,
    setFamilyPrimary,
    getFamiliesByProductCode,
    getFamiliesForProduct,
    getOrphanProducts,
} from '../../../utils/repositories/familyRepository';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFamilyRow(overrides: Record<string, unknown> = {}) {
    return {
        id: 1,
        name: 'Familia Motor',
        description: 'Componentes de motor',
        linea_code: '095',
        linea_name: 'VOLKSWAGEN',
        active: 1,
        created_at: '2026-01-01',
        updated_at: '2026-01-15',
        member_count: 3,
        ...overrides,
    };
}

function makeMemberRow(overrides: Record<string, unknown> = {}) {
    return {
        id: 10,
        family_id: 1,
        product_id: 100,
        is_primary: 0,
        added_at: '2026-01-10',
        codigo: 'ABC-001',
        descripcion: 'Producto A',
        linea_code: '095',
        linea_name: 'VOLKSWAGEN',
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('familyRepository', () => {
    // ----- listFamilies -----
    describe('listFamilies', () => {
        it('should return mapped families with memberCount', async () => {
            mockSelect.mockResolvedValue([
                makeFamilyRow(),
                makeFamilyRow({ id: 2, name: 'Familia Chasis', member_count: 5 }),
            ]);
            const families = await listFamilies();
            expect(families).toHaveLength(2);
            expect(families[0].name).toBe('Familia Motor');
            expect(families[0].lineaCode).toBe('095');
            expect(families[0].active).toBe(true);
            expect(families[0].memberCount).toBe(3);
            expect(families[1].memberCount).toBe(5);
        });

        it('should filter by search term', async () => {
            mockSelect.mockResolvedValue([]);
            await listFamilies({ search: 'Motor' });
            const sql = mockSelect.mock.calls[0][0] as string;
            expect(sql).toContain('pf.name LIKE ?');
            expect(sql).toContain('pf.description LIKE ?');
            expect(mockSelect.mock.calls[0][1]).toContain('%Motor%');
        });

        it('should filter by lineaCode', async () => {
            mockSelect.mockResolvedValue([]);
            await listFamilies({ lineaCode: '012' });
            const sql = mockSelect.mock.calls[0][0] as string;
            expect(sql).toContain('pf.linea_code = ?');
            expect(mockSelect.mock.calls[0][1]).toContain('012');
        });

        it('should include active filter by default', async () => {
            mockSelect.mockResolvedValue([]);
            await listFamilies();
            const sql = mockSelect.mock.calls[0][0] as string;
            expect(sql).toContain('pf.active = 1');
        });

        it('should support limit option', async () => {
            mockSelect.mockResolvedValue([]);
            await listFamilies({ limit: 25 });
            const sql = mockSelect.mock.calls[0][0] as string;
            expect(sql).toContain('LIMIT 25');
        });
    });

    // ----- getFamilyById -----
    describe('getFamilyById', () => {
        it('should return family when found', async () => {
            mockSelect.mockResolvedValue([makeFamilyRow()]);
            const family = await getFamilyById(1);
            expect(family).not.toBeNull();
            expect(family!.id).toBe(1);
            expect(family!.name).toBe('Familia Motor');
            expect(family!.lineaName).toBe('VOLKSWAGEN');
            expect(family!.active).toBe(true);
            expect(family!.memberCount).toBe(3);
        });

        it('should return null when not found', async () => {
            mockSelect.mockResolvedValue([]);
            const family = await getFamilyById(999);
            expect(family).toBeNull();
        });
    });

    // ----- getFamilyByName -----
    describe('getFamilyByName', () => {
        it('should return family when found by name', async () => {
            mockSelect.mockResolvedValue([makeFamilyRow({ name: 'Familia Chasis' })]);
            const family = await getFamilyByName('Familia Chasis');
            expect(family).not.toBeNull();
            expect(family!.name).toBe('Familia Chasis');
            expect(mockSelect.mock.calls[0][1]).toEqual(['Familia Chasis']);
        });

        it('should return null when name not found', async () => {
            mockSelect.mockResolvedValue([]);
            const family = await getFamilyByName('No existe');
            expect(family).toBeNull();
        });
    });

    // ----- createFamily -----
    describe('createFamily', () => {
        it('should call execute with correct SQL and return lastInsertId', async () => {
            mockExecute.mockResolvedValue({ rowsAffected: 1, lastInsertId: 7 });
            const id = await createFamily({
                name: 'Familia Nueva',
                description: 'Desc nueva',
                lineaCode: '020',
                lineaName: 'FORD',
            });
            expect(id).toBe(7);
            expect(mockExecute).toHaveBeenCalledTimes(1);
            const sql = mockExecute.mock.calls[0][0] as string;
            expect(sql).toContain('INSERT INTO product_families');
            expect(mockExecute.mock.calls[0][1]).toEqual([
                'Familia Nueva', 'Desc nueva', '020', 'FORD',
            ]);
        });

        it('should use empty string defaults for optional fields', async () => {
            mockExecute.mockResolvedValue({ rowsAffected: 1, lastInsertId: 8 });
            await createFamily({ name: 'Solo nombre' });
            expect(mockExecute.mock.calls[0][1]).toEqual([
                'Solo nombre', '', '', '',
            ]);
        });
    });

    // ----- updateFamily -----
    describe('updateFamily', () => {
        it('should build SET clause dynamically', async () => {
            mockExecute.mockResolvedValue({ rowsAffected: 1, lastInsertId: 0 });
            await updateFamily(1, { name: 'Renamed', description: 'New desc' });
            expect(mockExecute).toHaveBeenCalledTimes(1);
            const sql = mockExecute.mock.calls[0][0] as string;
            expect(sql).toContain('name = ?');
            expect(sql).toContain('description = ?');
            expect(sql).toContain("updated_at = datetime('now')");
            expect(sql).toContain('WHERE id = ?');
            expect(mockExecute.mock.calls[0][1]).toEqual(['Renamed', 'New desc', 1]);
        });

        it('should handle active field as 0/1', async () => {
            mockExecute.mockResolvedValue({ rowsAffected: 1, lastInsertId: 0 });
            await updateFamily(5, { active: false });
            const bindings = mockExecute.mock.calls[0][1] as unknown[];
            expect(bindings).toContain(0);
            expect(bindings).toContain(5);
        });

        it('should be no-op when no fields provided', async () => {
            await updateFamily(1, {});
            expect(mockExecute).not.toHaveBeenCalled();
        });
    });

    // ----- deleteFamily -----
    describe('deleteFamily', () => {
        it('should delete members first then family', async () => {
            mockExecute.mockResolvedValue({ rowsAffected: 1, lastInsertId: 0 });
            await deleteFamily(3);
            expect(mockExecute).toHaveBeenCalledTimes(2);
            const sql1 = mockExecute.mock.calls[0][0] as string;
            const sql2 = mockExecute.mock.calls[1][0] as string;
            expect(sql1).toContain('DELETE FROM product_family_members');
            expect(mockExecute.mock.calls[0][1]).toEqual([3]);
            expect(sql2).toContain('DELETE FROM product_families');
            expect(mockExecute.mock.calls[1][1]).toEqual([3]);
        });
    });

    // ----- getFamilyCount -----
    describe('getFamilyCount', () => {
        it('should return count from database', async () => {
            mockSelect.mockResolvedValue([{ cnt: 15 }]);
            const count = await getFamilyCount();
            expect(count).toBe(15);
            const sql = mockSelect.mock.calls[0][0] as string;
            expect(sql).toContain('COUNT(*)');
            expect(sql).toContain('active = 1');
        });

        it('should return 0 when no rows', async () => {
            mockSelect.mockResolvedValue([]);
            const count = await getFamilyCount();
            expect(count).toBe(0);
        });
    });

    // ----- getFamilyMembers -----
    describe('getFamilyMembers', () => {
        it('should return joined members with product data', async () => {
            mockSelect.mockResolvedValue([
                makeMemberRow({ is_primary: 1 }),
                makeMemberRow({ id: 11, product_id: 101, codigo: 'DEF-002', is_primary: 0 }),
            ]);
            const members = await getFamilyMembers(1);
            expect(members).toHaveLength(2);
            expect(members[0].isPrimary).toBe(true);
            expect(members[0].codigo).toBe('ABC-001');
            expect(members[0].familyId).toBe(1);
            expect(members[0].productId).toBe(100);
            expect(members[1].isPrimary).toBe(false);
            expect(members[1].codigo).toBe('DEF-002');
            const sql = mockSelect.mock.calls[0][0] as string;
            expect(sql).toContain('JOIN products p');
            expect(mockSelect.mock.calls[0][1]).toEqual([1]);
        });
    });

    // ----- addFamilyMember -----
    describe('addFamilyMember', () => {
        it('should call INSERT OR IGNORE', async () => {
            mockExecute.mockResolvedValue({ rowsAffected: 1, lastInsertId: 0 });
            await addFamilyMember(1, 100);
            expect(mockExecute).toHaveBeenCalledTimes(1);
            const sql = mockExecute.mock.calls[0][0] as string;
            expect(sql).toContain('INSERT OR IGNORE');
            expect(sql).toContain('product_family_members');
            // isPrimary defaults to false (0)
            expect(mockExecute.mock.calls[0][1]).toEqual([1, 100, 0]);
        });

        it('should pass isPrimary as 1 when true', async () => {
            mockExecute.mockResolvedValue({ rowsAffected: 1, lastInsertId: 0 });
            await addFamilyMember(1, 100, true);
            expect(mockExecute.mock.calls[0][1]).toEqual([1, 100, 1]);
        });
    });

    // ----- removeFamilyMember -----
    describe('removeFamilyMember', () => {
        it('should call DELETE with correct bindings', async () => {
            mockExecute.mockResolvedValue({ rowsAffected: 1, lastInsertId: 0 });
            await removeFamilyMember(1, 100);
            expect(mockExecute).toHaveBeenCalledTimes(1);
            const sql = mockExecute.mock.calls[0][0] as string;
            expect(sql).toContain('DELETE FROM product_family_members');
            expect(mockExecute.mock.calls[0][1]).toEqual([1, 100]);
        });
    });

    // ----- setFamilyPrimary -----
    describe('setFamilyPrimary', () => {
        it('should use atomic CASE WHEN to set primary in a single query', async () => {
            mockExecute.mockResolvedValue({ rowsAffected: 3, lastInsertId: 0 });
            await setFamilyPrimary(1, 200);
            expect(mockExecute).toHaveBeenCalledTimes(1);
            const sql = mockExecute.mock.calls[0][0] as string;
            expect(sql).toContain('CASE WHEN product_id = ?');
            expect(sql).toContain('THEN 1 ELSE 0 END');
            expect(sql).toContain('WHERE family_id = ?');
            // Bindings: [productId, familyId]
            expect(mockExecute.mock.calls[0][1]).toEqual([200, 1]);
        });
    });

    // ----- getFamiliesByProductCode -----
    describe('getFamiliesByProductCode', () => {
        it('should join through products table', async () => {
            mockSelect.mockResolvedValue([makeFamilyRow()]);
            const families = await getFamiliesByProductCode('ABC-001', '095');
            expect(families).toHaveLength(1);
            expect(families[0].name).toBe('Familia Motor');
            const sql = mockSelect.mock.calls[0][0] as string;
            expect(sql).toContain('JOIN product_family_members pfm');
            expect(sql).toContain('JOIN products p');
            expect(sql).toContain('p.codigo = ?');
            expect(sql).toContain('p.linea_code = ?');
            expect(mockSelect.mock.calls[0][1]).toEqual(['ABC-001', '095']);
        });
    });

    // ----- getFamiliesForProduct -----
    describe('getFamiliesForProduct', () => {
        it('should join through members table by product ID', async () => {
            mockSelect.mockResolvedValue([
                makeFamilyRow(),
                makeFamilyRow({ id: 2, name: 'Familia Chasis' }),
            ]);
            const families = await getFamiliesForProduct(100);
            expect(families).toHaveLength(2);
            const sql = mockSelect.mock.calls[0][0] as string;
            expect(sql).toContain('JOIN product_family_members pfm');
            expect(sql).toContain('pfm.product_id = ?');
            expect(sql).toContain('pf.active = 1');
            expect(mockSelect.mock.calls[0][1]).toEqual([100]);
        });
    });

    // ----- getOrphanProducts -----
    describe('getOrphanProducts', () => {
        it('should use LEFT JOIN with NULL check', async () => {
            mockSelect.mockResolvedValue([
                { id: 50, codigo: 'ORPHAN-1', descripcion: 'Sin familia', linea_code: '095', linea_name: 'VW' },
            ]);
            const orphans = await getOrphanProducts();
            expect(orphans).toHaveLength(1);
            expect(orphans[0].codigo).toBe('ORPHAN-1');
            expect(orphans[0].lineaCode).toBe('095');
            const sql = mockSelect.mock.calls[0][0] as string;
            expect(sql).toContain('LEFT JOIN product_family_members');
            expect(sql).toContain('pfm.id IS NULL');
            expect(sql).toContain('p.active = 1');
        });

        it('should filter by lineaCode when provided', async () => {
            mockSelect.mockResolvedValue([]);
            await getOrphanProducts({ lineaCode: '012' });
            const sql = mockSelect.mock.calls[0][0] as string;
            expect(sql).toContain('p.linea_code = ?');
            expect(mockSelect.mock.calls[0][1]).toContain('012');
        });

        it('should support limit option', async () => {
            mockSelect.mockResolvedValue([]);
            await getOrphanProducts({ limit: 50 });
            const sql = mockSelect.mock.calls[0][0] as string;
            expect(sql).toContain('LIMIT 50');
        });
    });
});
