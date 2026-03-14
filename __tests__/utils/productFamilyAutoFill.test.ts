import {
    truncateApplicableParts,
    APPLICABLE_PARTS_DISPLAY_MAX,
    resolveApplicableParts,
} from '../../utils/productFamilyAutoFill';
import { getFamiliesByProductCode, getFamilyMembers } from '../../utils/repositories/familyRepository';
import { listProducts } from '../../utils/repositories/productRepository';
import type { ProductFamily, ProductFamilyMember } from '../../utils/repositories/familyRepository';
import type { Product } from '../../utils/repositories/productRepository';

vi.mock('../../utils/repositories/familyRepository', () => ({
    getFamiliesByProductCode: vi.fn(),
    getFamilyMembers: vi.fn(),
}));
vi.mock('../../utils/repositories/productRepository', () => ({
    listProducts: vi.fn(),
}));

const mockGetFamilies = getFamiliesByProductCode as ReturnType<typeof vi.fn>;
const mockGetMembers = getFamilyMembers as ReturnType<typeof vi.fn>;
const mockListProducts = listProducts as ReturnType<typeof vi.fn>;

function makeFamily(overrides: Partial<ProductFamily> = {}): ProductFamily {
    return {
        id: 1,
        name: 'Test Family',
        description: '',
        lineaCode: 'ZAC',
        lineaName: 'ZAC Line',
        active: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        ...overrides,
    };
}

function makeMember(overrides: Partial<ProductFamilyMember> = {}): ProductFamilyMember {
    return {
        id: 1,
        familyId: 1,
        productId: 1,
        isPrimary: false,
        addedAt: '2026-01-01',
        codigo: 'PROD-001',
        ...overrides,
    };
}

function makeProduct(overrides: Partial<Product> = {}): Product {
    return {
        id: 1,
        codigo: 'PROD-001',
        descripcion: 'Test Product',
        lineaCode: 'ZAC',
        lineaName: 'ZAC Line',
        active: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// truncateApplicableParts
// ---------------------------------------------------------------------------

describe('truncateApplicableParts', () => {
    it('returns empty string for empty input', () => {
        expect(truncateApplicableParts('')).toBe('');
    });

    it('returns same string when <= 20 lines', () => {
        const lines = Array.from({ length: 15 }, (_, i) => `PROD-${i + 1}`).join('\n');
        expect(truncateApplicableParts(lines)).toBe(lines);
    });

    it('truncates to 20 + "... y N mas" when > 20 lines', () => {
        const all = Array.from({ length: 30 }, (_, i) => `PROD-${i + 1}`);
        const input = all.join('\n');
        const result = truncateApplicableParts(input);
        const outputLines = result.split('\n');
        expect(outputLines).toHaveLength(21);
        expect(outputLines[20]).toBe('... y 10 más');
        // First 20 lines preserved
        expect(outputLines.slice(0, 20)).toEqual(all.slice(0, 20));
    });

    it('custom max parameter works (e.g., max=5)', () => {
        const all = Array.from({ length: 10 }, (_, i) => `ITEM-${i + 1}`);
        const input = all.join('\n');
        const result = truncateApplicableParts(input, 5);
        const outputLines = result.split('\n');
        expect(outputLines).toHaveLength(6);
        expect(outputLines[5]).toBe('... y 5 más');
        expect(outputLines.slice(0, 5)).toEqual(all.slice(0, 5));
    });

    it('filters empty lines from input', () => {
        const input = 'A\n\nB\n   \nC';
        const result = truncateApplicableParts(input);
        expect(result).toBe('A\nB\nC');
    });

    it('handles single line (no truncation)', () => {
        expect(truncateApplicableParts('SOLO-PRODUCTO')).toBe('SOLO-PRODUCTO');
    });

    it('handles exactly 20 lines (no truncation)', () => {
        const lines = Array.from({ length: 20 }, (_, i) => `P-${i + 1}`);
        const input = lines.join('\n');
        const result = truncateApplicableParts(input);
        expect(result).toBe(input);
        expect(result.split('\n')).toHaveLength(20);
    });

    it('handles 21 lines (truncates to 20 + "... y 1 mas")', () => {
        const all = Array.from({ length: 21 }, (_, i) => `CODE-${i + 1}`);
        const input = all.join('\n');
        const result = truncateApplicableParts(input);
        const outputLines = result.split('\n');
        expect(outputLines).toHaveLength(21);
        expect(outputLines[20]).toBe('... y 1 más');
        expect(outputLines.slice(0, 20)).toEqual(all.slice(0, 20));
    });
});

// ---------------------------------------------------------------------------
// resolveApplicableParts
// ---------------------------------------------------------------------------

describe('resolveApplicableParts', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns family siblings when product is in a family', async () => {
        mockGetFamilies.mockResolvedValue([makeFamily({ id: 10 })]);
        mockGetMembers.mockResolvedValue([
            makeMember({ codigo: 'PROD-001' }),
            makeMember({ codigo: 'PROD-002' }),
            makeMember({ codigo: 'PROD-003' }),
        ]);

        const result = await resolveApplicableParts('PROD-001', 'ZAC');

        expect(result).toBe('PROD-002\nPROD-003');
        expect(mockGetFamilies).toHaveBeenCalledWith('PROD-001', 'ZAC');
        expect(mockGetMembers).toHaveBeenCalledWith(10);
        expect(mockListProducts).not.toHaveBeenCalled();
    });

    it('excludes the product itself from results', async () => {
        mockGetFamilies.mockResolvedValue([makeFamily()]);
        mockGetMembers.mockResolvedValue([
            makeMember({ codigo: 'TARGET' }),
            makeMember({ codigo: 'SIBLING-A' }),
            makeMember({ codigo: 'SIBLING-B' }),
        ]);

        const result = await resolveApplicableParts('TARGET', 'ZAC');

        expect(result).toBe('SIBLING-A\nSIBLING-B');
        expect(result).not.toContain('TARGET');
    });

    it('returns primary member first (family members already ordered by primary DESC)', async () => {
        mockGetFamilies.mockResolvedValue([makeFamily({ id: 5 })]);
        // getFamilyMembers orders by is_primary DESC, so primary comes first
        mockGetMembers.mockResolvedValue([
            makeMember({ codigo: 'PRIMARY-01', isPrimary: true }),
            makeMember({ codigo: 'SELF', isPrimary: false }),
            makeMember({ codigo: 'SECONDARY-02', isPrimary: false }),
        ]);

        const result = await resolveApplicableParts('SELF', 'ZAC');

        expect(result).toBe('PRIMARY-01\nSECONDARY-02');
        // Primary is listed first because the DB query returns it first
        expect(result!.split('\n')[0]).toBe('PRIMARY-01');
    });

    it('returns null when family has only the product itself (no siblings)', async () => {
        mockGetFamilies.mockResolvedValue([makeFamily()]);
        mockGetMembers.mockResolvedValue([
            makeMember({ codigo: 'PROD-001' }),
        ]);

        const result = await resolveApplicableParts('PROD-001', 'ZAC');

        expect(result).toBeNull();
    });

    it('returns null when family members have empty codigos', async () => {
        mockGetFamilies.mockResolvedValue([makeFamily()]);
        mockGetMembers.mockResolvedValue([
            makeMember({ codigo: 'PROD-001' }),
            makeMember({ codigo: '' }),
            makeMember({ codigo: undefined }),
        ]);

        const result = await resolveApplicableParts('PROD-001', 'ZAC');

        // All siblings are filtered out: PROD-001 is self, '' and undefined are empty
        expect(result).toBeNull();
    });

    it('falls back to line-based when no family found', async () => {
        mockGetFamilies.mockResolvedValue([]);
        mockListProducts.mockResolvedValue([
            makeProduct({ codigo: 'PROD-001' }),
            makeProduct({ codigo: 'PROD-002' }),
            makeProduct({ codigo: 'PROD-003' }),
        ]);

        const result = await resolveApplicableParts('PROD-001', 'ZAC');

        expect(result).toBe('PROD-002\nPROD-003');
        expect(mockListProducts).toHaveBeenCalledWith({
            lineaCode: 'ZAC',
            activeOnly: true,
            limit: 51,
        });
    });

    it('falls back to line-based when family lookup throws', async () => {
        mockGetFamilies.mockRejectedValue(new Error('DB connection failed'));
        mockListProducts.mockResolvedValue([
            makeProduct({ codigo: 'PROD-001' }),
            makeProduct({ codigo: 'PROD-005' }),
        ]);

        const result = await resolveApplicableParts('PROD-001', 'ZAC');

        expect(result).toBe('PROD-005');
        expect(mockListProducts).toHaveBeenCalled();
    });

    it('returns null when both lookups fail', async () => {
        mockGetFamilies.mockRejectedValue(new Error('DB error'));
        mockListProducts.mockRejectedValue(new Error('DB error'));

        const result = await resolveApplicableParts('PROD-001', 'ZAC');

        expect(result).toBeNull();
    });

    it('line-based fallback caps at 50 products', async () => {
        // listProducts is called with limit: 51 (LINE_FALLBACK_LIMIT + 1)
        // Then result is sliced to 50 after filtering self
        const products = Array.from({ length: 55 }, (_, i) =>
            makeProduct({ id: i + 1, codigo: `P-${String(i).padStart(3, '0')}` })
        );
        mockGetFamilies.mockResolvedValue([]);
        mockListProducts.mockResolvedValue(products);

        const result = await resolveApplicableParts('NONE-MATCH', 'ZAC');

        // All 55 codes pass the filter (none match 'NONE-MATCH'), sliced to 50
        const lines = result!.split('\n');
        expect(lines).toHaveLength(50);
    });

    it('returns null when line has no other products', async () => {
        mockGetFamilies.mockResolvedValue([]);
        mockListProducts.mockResolvedValue([
            makeProduct({ codigo: 'PROD-001' }),
        ]);

        const result = await resolveApplicableParts('PROD-001', 'ZAC');

        expect(result).toBeNull();
    });

    it('family with 100 members returns all siblings (no limit on family-based)', async () => {
        const members = Array.from({ length: 100 }, (_, i) =>
            makeMember({ id: i + 1, codigo: `FAM-${String(i).padStart(3, '0')}` })
        );
        // Add self as member 101
        members.push(makeMember({ id: 101, codigo: 'SELF' }));

        mockGetFamilies.mockResolvedValue([makeFamily({ id: 7 })]);
        mockGetMembers.mockResolvedValue(members);

        const result = await resolveApplicableParts('SELF', 'ZAC');

        const lines = result!.split('\n');
        // 100 family members minus self = 100 siblings
        expect(lines).toHaveLength(100);
        expect(lines).not.toContain('SELF');
    });

    it('correctly passes lineaCode to listProducts fallback', async () => {
        mockGetFamilies.mockResolvedValue([]);
        mockListProducts.mockResolvedValue([]);

        await resolveApplicableParts('PROD-X', 'TOYOTA');

        expect(mockListProducts).toHaveBeenCalledWith({
            lineaCode: 'TOYOTA',
            activeOnly: true,
            limit: 51,
        });
    });
});
