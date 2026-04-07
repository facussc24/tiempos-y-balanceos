/**
 * Tests for FamilyManager component
 *
 * Covers: rendering, list view, create view, edit view (members, add, remove,
 * set primary), delete flow, keyboard shortcuts, and edge cases.
 */
import React from 'react';
import { vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act, cleanup } from '@testing-library/react';
import type { ProductFamily, ProductFamilyMember } from '../../utils/repositories/familyRepository';
import type { Product } from '../../utils/repositories/productRepository';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../utils/repositories/familyRepository', () => ({
    listFamilies: vi.fn(),
    createFamily: vi.fn(),
    updateFamily: vi.fn(),
    deleteFamily: vi.fn(),
    getFamilyMembers: vi.fn(),
    addFamilyMember: vi.fn(),
    removeFamilyMember: vi.fn(),
    setFamilyPrimary: vi.fn(),
    getFamilyCount: vi.fn(),
    getOrphanProducts: vi.fn(),
}));

vi.mock('../../utils/repositories/productRepository', () => ({
    listProducts: vi.fn(),
}));

vi.mock('../../modules/family/hooks/useFamilyDocuments', () => ({
    useFamilyDocuments: vi.fn().mockReturnValue({
        masterDocs: { pfd: null, amfe: null, cp: null, ho: null },
        variantDocs: [],
        loading: false,
        error: null,
        linkMaster: vi.fn(),
        unlinkMaster: vi.fn(),
        refresh: vi.fn(),
    }),
}));

vi.mock('../../utils/repositories/amfeRepository', () => ({
    listAmfeDocuments: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../utils/repositories/cpRepository', () => ({
    listCpDocuments: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../utils/repositories/hoRepository', () => ({
    listHoDocuments: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../utils/repositories/pfdRepository', () => ({
    listPfdDocuments: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    exportDiagnosticJSON: vi.fn(),
}));

// Import mocked functions after vi.mock
import FamilyManager from '../../components/modals/FamilyManager';
import {
    listFamilies,
    createFamily,
    updateFamily,
    deleteFamily,
    getFamilyMembers,
    addFamilyMember,
    removeFamilyMember,
    setFamilyPrimary,
    getFamilyCount,
    getOrphanProducts,
} from '../../utils/repositories/familyRepository';
import { listProducts } from '../../utils/repositories/productRepository';

// Cast mocked functions
const mockListFamilies = listFamilies as ReturnType<typeof vi.fn>;
const mockCreateFamily = createFamily as ReturnType<typeof vi.fn>;
const mockUpdateFamily = updateFamily as ReturnType<typeof vi.fn>;
const mockDeleteFamily = deleteFamily as ReturnType<typeof vi.fn>;
const mockGetFamilyMembers = getFamilyMembers as ReturnType<typeof vi.fn>;
const mockAddFamilyMember = addFamilyMember as ReturnType<typeof vi.fn>;
const mockRemoveFamilyMember = removeFamilyMember as ReturnType<typeof vi.fn>;
const mockSetFamilyPrimary = setFamilyPrimary as ReturnType<typeof vi.fn>;
const mockGetFamilyCount = getFamilyCount as ReturnType<typeof vi.fn>;
const mockGetOrphanProducts = getOrphanProducts as ReturnType<typeof vi.fn>;
const mockListProducts = listProducts as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

const makeMember = (overrides?: Partial<ProductFamilyMember>): ProductFamilyMember => ({
    id: 1,
    familyId: 1,
    productId: 100,
    isPrimary: false,
    addedAt: '2026-01-01',
    codigo: 'ABC-123',
    descripcion: 'Test Product',
    lineaCode: '001',
    lineaName: 'TESTLINE',
    ...overrides,
});

const makeFamily = (overrides?: Partial<ProductFamily>): ProductFamily => ({
    id: 1,
    name: 'Test Family',
    description: 'Desc',
    lineaCode: '',
    lineaName: '',
    active: true,
    createdAt: '',
    updatedAt: '',
    memberCount: 3,
    ...overrides,
});

const makeProduct = (overrides?: Partial<Product>): Product => ({
    id: 200,
    codigo: 'XYZ-789',
    descripcion: 'Another Product',
    lineaCode: '002',
    lineaName: 'OTHERLINE',
    active: true,
    createdAt: '',
    updatedAt: '',
    ...overrides,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Set up default mock returns so the component loads without errors. */
function setupDefaultMocks(families: ProductFamily[] = []) {
    mockListFamilies.mockResolvedValue(families);
    mockGetFamilyCount.mockResolvedValue(families.length);
    mockGetOrphanProducts.mockResolvedValue([]);
    mockGetFamilyMembers.mockResolvedValue([]);
    mockListProducts.mockResolvedValue([]);
    mockCreateFamily.mockResolvedValue(99);
    mockUpdateFamily.mockResolvedValue(undefined);
    mockDeleteFamily.mockResolvedValue(undefined);
    mockAddFamilyMember.mockResolvedValue(undefined);
    mockRemoveFamilyMember.mockResolvedValue(undefined);
    mockSetFamilyPrimary.mockResolvedValue(undefined);
}

/** Render the component and wait for initial load (listFamilies call). */
async function renderAndWait(onClose = vi.fn()) {
    let result!: ReturnType<typeof render>;
    await act(async () => {
        result = render(<FamilyManager onClose={onClose} />);
    });
    // Wait for initial data load
    await waitFor(() => {
        expect(mockListFamilies).toHaveBeenCalled();
    });
    return { ...result, onClose };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('FamilyManager', () => {
    beforeEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
        setupDefaultMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
        cleanup();
    });

    // -----------------------------------------------------------------------
    // 1. Rendering
    // -----------------------------------------------------------------------

    describe('Rendering', () => {
        it('renders header "Familias de Productos"', async () => {
            await renderAndWait();
            expect(screen.getByText('Familias de Productos')).toBeDefined();
        });

        it('renders family count badge', async () => {
            mockGetFamilyCount.mockResolvedValue(5);
            await renderAndWait();
            await waitFor(() => {
                expect(screen.getByText('5 familias')).toBeDefined();
            });
        });

        it('renders search input and "Nueva" button', async () => {
            await renderAndWait();
            expect(screen.getByPlaceholderText('Buscar familia...')).toBeDefined();
            expect(screen.getByText('Nueva')).toBeDefined();
        });

        it('renders empty state when no families', async () => {
            setupDefaultMocks([]);
            await renderAndWait();
            await waitFor(() => {
                expect(screen.getByText('No hay familias creadas.')).toBeDefined();
            });
        });

        it('close button calls onClose', async () => {
            const onClose = vi.fn();
            await renderAndWait(onClose);
            // The close button is in the header area (bg-purple-50)
            const closeButtons = screen.getAllByRole('button');
            const headerCloseBtn = closeButtons.find(
                btn => btn.querySelector('svg') && btn.closest('.bg-purple-50')
            );
            expect(headerCloseBtn).toBeDefined();
            fireEvent.click(headerCloseBtn!);
            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });

    // -----------------------------------------------------------------------
    // 2. Family list view
    // -----------------------------------------------------------------------

    describe('Family list view', () => {
        const twoFamilies = [
            makeFamily({ id: 1, name: 'Espejos Exteriores', memberCount: 5 }),
            makeFamily({ id: 2, name: 'Paragolpes Trasero', memberCount: 2, description: 'Linea PWA' }),
        ];

        it('displays family names from loaded data', async () => {
            setupDefaultMocks(twoFamilies);
            await renderAndWait();
            await waitFor(() => {
                expect(screen.getByText('Espejos Exteriores')).toBeDefined();
                expect(screen.getByText('Paragolpes Trasero')).toBeDefined();
            });
        });

        it('shows member count badge per family', async () => {
            setupDefaultMocks(twoFamilies);
            await renderAndWait();
            await waitFor(() => {
                expect(screen.getByText('5 prod.')).toBeDefined();
                expect(screen.getByText('2 prod.')).toBeDefined();
            });
        });

        it('filters families via searchQuery (triggers loadFamilies)', async () => {
            setupDefaultMocks(twoFamilies);
            await renderAndWait();
            const searchInput = screen.getByPlaceholderText('Buscar familia...');
            fireEvent.change(searchInput, { target: { value: 'Espejo' } });
            await waitFor(() => {
                const calls = mockListFamilies.mock.calls;
                const lastCall = calls[calls.length - 1];
                expect(lastCall[0]?.search).toBe('Espejo');
            });
        });

        it('shows orphan count footer', async () => {
            setupDefaultMocks(twoFamilies);
            // First call with limit:1 returns at least 1 orphan, then full call returns 4
            mockGetOrphanProducts
                .mockResolvedValueOnce([{ id: 1 }])  // limit:1 quick check
                .mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);  // full count
            await renderAndWait();
            await waitFor(() => {
                expect(screen.getByText(/4 productos sin familia asignada/)).toBeDefined();
            });
        });

        it('shows error banner on loadFamilies failure', async () => {
            mockListFamilies.mockRejectedValue(new Error('DB error'));
            await renderAndWait();
            await waitFor(() => {
                expect(screen.getByText('Error al cargar familias')).toBeDefined();
            });
        });

        it('click family triggers handleEditFamily and switches to edit view', async () => {
            const family = makeFamily({ id: 1, name: 'Espejos Exteriores' });
            setupDefaultMocks([family]);
            const members = [makeMember({ id: 1, codigo: 'ESP-001' })];
            mockGetFamilyMembers.mockResolvedValue(members);
            await renderAndWait();

            await waitFor(() => {
                expect(screen.getByText('Espejos Exteriores')).toBeDefined();
            });

            fireEvent.click(screen.getByText('Espejos Exteriores'));

            await waitFor(() => {
                expect(mockGetFamilyMembers).toHaveBeenCalledWith(1);
                expect(screen.getByText('Productos (1)')).toBeDefined();
            });
        });
    });

    // -----------------------------------------------------------------------
    // 3. Create view
    // -----------------------------------------------------------------------

    describe('Create view', () => {
        it('click "Nueva" switches to create view', async () => {
            await renderAndWait();
            fireEvent.click(screen.getByText('Nueva'));
            expect(screen.getByText('Nueva Familia')).toBeDefined();
        });

        it('shows name/description inputs with placeholders', async () => {
            await renderAndWait();
            fireEvent.click(screen.getByText('Nueva'));
            expect(screen.getByPlaceholderText('Ej: Espejos Exteriores LEQUIPE')).toBeDefined();
            expect(screen.getByPlaceholderText(/Descripción opcional del proceso compartido/)).toBeDefined();
        });

        it('"Crear" button disabled when name empty', async () => {
            await renderAndWait();
            fireEvent.click(screen.getByText('Nueva'));
            const createBtn = screen.getByText('Crear y agregar productos') as HTMLButtonElement;
            expect(createBtn.disabled).toBe(true);
        });

        it('creates family and switches to edit view', async () => {
            mockCreateFamily.mockResolvedValue(42);
            await renderAndWait();
            fireEvent.click(screen.getByText('Nueva'));

            const nameInput = screen.getByPlaceholderText('Ej: Espejos Exteriores LEQUIPE');
            fireEvent.change(nameInput, { target: { value: 'New Test Family' } });

            fireEvent.click(screen.getByText('Crear y agregar productos'));

            await waitFor(() => {
                expect(mockCreateFamily).toHaveBeenCalledWith({
                    name: 'New Test Family',
                    description: '',
                });
                // Should now be in edit view
                expect(screen.getByText(/Productos \(0\)/)).toBeDefined();
            });
        });

        it('shows error on duplicate name (UNIQUE constraint)', async () => {
            mockCreateFamily.mockRejectedValue(new Error('UNIQUE constraint failed'));
            await renderAndWait();
            fireEvent.click(screen.getByText('Nueva'));

            const nameInput = screen.getByPlaceholderText('Ej: Espejos Exteriores LEQUIPE');
            fireEvent.change(nameInput, { target: { value: 'Duplicate Family' } });

            fireEvent.click(screen.getByText('Crear y agregar productos'));

            await waitFor(() => {
                expect(screen.getByText('Ya existe una familia con ese nombre')).toBeDefined();
            });
        });
    });

    // -----------------------------------------------------------------------
    // 4. Edit view - members
    // -----------------------------------------------------------------------

    describe('Edit view - members', () => {
        async function enterEditView(
            members: ProductFamilyMember[] = [makeMember()],
            family: ProductFamily = makeFamily(),
        ) {
            setupDefaultMocks([family]);
            mockGetFamilyMembers.mockResolvedValue(members);
            await renderAndWait();
            await waitFor(() => {
                expect(screen.getByText(family.name)).toBeDefined();
            });
            fireEvent.click(screen.getByText(family.name));
            await waitFor(() => {
                expect(screen.getByText(`Productos (${members.length})`)).toBeDefined();
            });
        }

        it('shows member list with codigo and descripcion', async () => {
            const member = makeMember({ codigo: 'ESP-001', descripcion: 'Espejo Exterior IZQ' });
            await enterEditView([member]);
            expect(screen.getByText('ESP-001')).toBeDefined();
            expect(screen.getByText('Espejo Exterior IZQ')).toBeDefined();
        });

        it('shows fallback text when codigo undefined (e.g. ID:100)', async () => {
            const member = makeMember({ codigo: undefined, productId: 100 });
            await enterEditView([member]);
            expect(screen.getByText('ID:100')).toBeDefined();
        });

        it('primary member has filled star (title "Producto primario")', async () => {
            const member = makeMember({ isPrimary: true });
            await enterEditView([member]);
            const primaryBtn = screen.getByTitle('Producto primario');
            expect(primaryBtn).toBeDefined();
        });

        it('empty state "Sin productos" when no members', async () => {
            await enterEditView([]);
            expect(screen.getByText(/Sin productos/)).toBeDefined();
        });

        it('back button returns to list view', async () => {
            await enterEditView();
            fireEvent.click(screen.getByText(/Volver a la lista/));
            await waitFor(() => {
                expect(screen.getByText('Test Family')).toBeDefined();
                expect(screen.getByPlaceholderText('Buscar familia...')).toBeDefined();
            });
        });

        it('name update triggers onBlur -> updateFamily', async () => {
            await enterEditView();
            const inputs = screen.getAllByRole('textbox');
            const nameInput = inputs.find(
                inp => (inp as HTMLInputElement).value === 'Test Family'
            ) as HTMLInputElement;
            expect(nameInput).toBeDefined();

            fireEvent.change(nameInput, { target: { value: 'Updated Name' } });
            fireEvent.blur(nameInput);

            await waitFor(() => {
                expect(mockUpdateFamily).toHaveBeenCalledWith(1, {
                    name: 'Updated Name',
                    description: 'Desc',
                });
            });
        });
    });

    // -----------------------------------------------------------------------
    // 5. Add member (debounced search uses fake timers)
    // -----------------------------------------------------------------------

    describe('Add member', () => {
        async function enterEditViewForAdd(members: ProductFamilyMember[] = []) {
            const family = makeFamily();
            setupDefaultMocks([family]);
            mockGetFamilyMembers.mockResolvedValue(members);
            // Render with REAL timers, then switch to fake after render stabilizes
            await renderAndWait();
            await waitFor(() => {
                expect(screen.getByText(family.name)).toBeDefined();
            });
            fireEvent.click(screen.getByText(family.name));
            await waitFor(() => {
                expect(screen.getByText(`Productos (${members.length})`)).toBeDefined();
            });
        }

        it('product search input renders in edit view', async () => {
            await enterEditViewForAdd();
            expect(screen.getByPlaceholderText(/Buscar por código o descripción/)).toBeDefined();
        });

        it('debounced search triggers after 200ms', async () => {
            const product = makeProduct({ id: 300, codigo: 'BOLT-10' });
            mockListProducts.mockResolvedValue([product]);

            await enterEditViewForAdd();

            // Switch to fake timers AFTER render is stable
            vi.useFakeTimers();

            const searchInput = screen.getByPlaceholderText(/Buscar por código o descripción/);
            fireEvent.change(searchInput, { target: { value: 'BO' } });

            // Before debounce fires
            expect(mockListProducts).not.toHaveBeenCalled();

            // Advance past 200ms debounce
            await act(async () => {
                vi.advanceTimersByTime(250);
            });

            vi.useRealTimers();

            await waitFor(() => {
                expect(mockListProducts).toHaveBeenCalledWith({
                    search: 'BO',
                    limit: 15,
                    activeOnly: true,
                });
            });
        });

        it('already-added products filtered from results', async () => {
            const existingMember = makeMember({ productId: 200 });
            const product200 = makeProduct({ id: 200, codigo: 'XYZ-789' });
            const product300 = makeProduct({ id: 300, codigo: 'NEW-001', descripcion: 'New Product' });

            await enterEditViewForAdd([existingMember]);

            // Set listProducts AFTER enterEditViewForAdd (which calls setupDefaultMocks)
            mockListProducts.mockResolvedValue([product200, product300]);

            const searchInput = screen.getByPlaceholderText(/Buscar por código o descripción/);
            fireEvent.change(searchInput, { target: { value: 'prod' } });

            // Wait for debounce (200ms) to fire and results to appear
            await waitFor(() => {
                // product300 should appear in search results
                expect(screen.getByText('NEW-001')).toBeDefined();
            });
        });

        it('click product calls addFamilyMember', async () => {
            const product = makeProduct({ id: 300, codigo: 'NEW-001', descripcion: 'New Product' });

            await enterEditViewForAdd();

            // Set listProducts AFTER enterEditViewForAdd
            mockListProducts.mockResolvedValue([product]);

            const searchInput = screen.getByPlaceholderText(/Buscar por código o descripción/);
            fireEvent.change(searchInput, { target: { value: 'NEW' } });

            // Wait for debounce to fire and results to appear
            await waitFor(() => {
                expect(screen.getByText('NEW-001')).toBeDefined();
            });

            fireEvent.click(screen.getByText('NEW-001'));

            await waitFor(() => {
                // First member in an empty family => isPrimary = true
                expect(mockAddFamilyMember).toHaveBeenCalledWith(1, 300, true);
            });
        });

        it('mutex prevents double-click (addingRef)', async () => {
            const product = makeProduct({ id: 300, codigo: 'NEW-001', descripcion: 'New Product' });

            await enterEditViewForAdd();

            // Set listProducts AFTER enterEditViewForAdd
            mockListProducts.mockResolvedValue([product]);
            // Make addFamilyMember return a pending promise (never resolves until we say so)
            let resolveAdd!: () => void;
            mockAddFamilyMember.mockImplementation(
                () => new Promise<void>(resolve => { resolveAdd = resolve; })
            );

            const searchInput = screen.getByPlaceholderText(/Buscar por código o descripción/);
            fireEvent.change(searchInput, { target: { value: 'NEW' } });

            // Wait for debounce to fire and results to appear
            await waitFor(() => {
                expect(screen.getByText('NEW-001')).toBeDefined();
            });

            // First click starts the async operation (mutex acquired)
            fireEvent.click(screen.getByText('NEW-001'));

            // Second click should be blocked by mutex
            const productEl = screen.queryByText('NEW-001');
            if (productEl) {
                fireEvent.click(productEl);
            }

            // Resolve the first add
            await act(async () => {
                resolveAdd();
            });

            // Only one call should have been made (mutex blocks second)
            expect(mockAddFamilyMember).toHaveBeenCalledTimes(1);
        });

        it('"Buscando..." clears when search < 2 chars', async () => {
            mockListProducts.mockResolvedValue([makeProduct()]);

            await enterEditViewForAdd();

            const searchInput = screen.getByPlaceholderText(/Buscar por código o descripción/);

            // Type 2 chars to trigger searching state
            fireEvent.change(searchInput, { target: { value: 'AB' } });
            // isSearching is set to true synchronously when length >= 2
            expect(screen.getByText('Buscando...')).toBeDefined();

            // Now set to 1 char -- effect early return sets isSearching false
            fireEvent.change(searchInput, { target: { value: 'A' } });

            await waitFor(() => {
                expect(screen.queryByText('Buscando...')).toBeNull();
            });
        });
    });

    // -----------------------------------------------------------------------
    // 6. Remove / Primary
    // -----------------------------------------------------------------------

    describe('Remove / Primary', () => {
        async function enterEditViewWithMembers(members: ProductFamilyMember[]) {
            const family = makeFamily();
            setupDefaultMocks([family]);
            mockGetFamilyMembers.mockResolvedValue(members);
            await renderAndWait();
            await waitFor(() => {
                expect(screen.getByText(family.name)).toBeDefined();
            });
            fireEvent.click(screen.getByText(family.name));
            await waitFor(() => {
                expect(screen.getByText(`Productos (${members.length})`)).toBeDefined();
            });
        }

        it('click X (remove) calls removeFamilyMember', async () => {
            const member = makeMember({ productId: 100, codigo: 'REM-001' });
            await enterEditViewWithMembers([member]);

            const removeBtn = screen.getByTitle('Quitar de la familia');
            fireEvent.click(removeBtn);

            await waitFor(() => {
                expect(mockRemoveFamilyMember).toHaveBeenCalledWith(1, 100);
            });
        });

        it('click star calls setFamilyPrimary', async () => {
            const member = makeMember({ productId: 100, isPrimary: false, codigo: 'PRI-001' });
            await enterEditViewWithMembers([member]);

            const starBtn = screen.getByTitle('Establecer como primario');
            fireEvent.click(starBtn);

            await waitFor(() => {
                expect(mockSetFamilyPrimary).toHaveBeenCalledWith(1, 100);
            });
        });

        it('remove error shows banner', async () => {
            const member = makeMember({ productId: 100, codigo: 'ERR-001' });
            await enterEditViewWithMembers([member]);

            // Set rejection AFTER enterEditView (which calls setupDefaultMocks)
            mockRemoveFamilyMember.mockRejectedValue(new Error('DB error'));

            const removeBtn = screen.getByTitle('Quitar de la familia');
            fireEvent.click(removeBtn);

            await waitFor(() => {
                expect(screen.getByText('Error al quitar producto')).toBeDefined();
            });
        });

        it('setPrimary error shows banner', async () => {
            const member = makeMember({ productId: 100, isPrimary: false, codigo: 'ERR-002' });
            await enterEditViewWithMembers([member]);

            // Set rejection AFTER enterEditView (which calls setupDefaultMocks)
            mockSetFamilyPrimary.mockRejectedValue(new Error('DB error'));

            const starBtn = screen.getByTitle('Establecer como primario');
            fireEvent.click(starBtn);

            await waitFor(() => {
                expect(screen.getByText('Error al establecer primario')).toBeDefined();
            });
        });
    });

    // -----------------------------------------------------------------------
    // 7. Delete
    // -----------------------------------------------------------------------

    describe('Delete', () => {
        it('trash icon click shows ConfirmModal dialog', async () => {
            const family = makeFamily({ id: 10, name: 'Delete Me' });
            setupDefaultMocks([family]);

            await renderAndWait();
            await waitFor(() => {
                expect(screen.getByText('Delete Me')).toBeDefined();
            });

            const deleteBtn = screen.getByTitle('Eliminar familia');
            fireEvent.click(deleteBtn);

            // ConfirmModal should appear with the title "Eliminar Familia"
            await waitFor(() => {
                expect(screen.getByText('Eliminar Familia')).toBeDefined();
            });

            // Click "Cancelar" to dismiss the modal
            fireEvent.click(screen.getByText('Cancelar'));

            // Since we cancelled, deleteFamily should NOT be called
            expect(mockDeleteFamily).not.toHaveBeenCalled();
        });

        it('calls deleteFamily on confirm', async () => {
            const family = makeFamily({ id: 10, name: 'Delete Me' });
            setupDefaultMocks([family]);

            await renderAndWait();
            await waitFor(() => {
                expect(screen.getByText('Delete Me')).toBeDefined();
            });

            const deleteBtn = screen.getByTitle('Eliminar familia');
            fireEvent.click(deleteBtn);

            // Wait for ConfirmModal to appear
            await waitFor(() => {
                expect(screen.getByText('Eliminar Familia')).toBeDefined();
            });

            // Click "Eliminar" to confirm deletion
            fireEvent.click(screen.getByText('Eliminar'));

            await waitFor(() => {
                expect(mockDeleteFamily).toHaveBeenCalledWith(10);
            });
        });

        it('selected family cleared if deleted (returns to list view)', async () => {
            const family = makeFamily({ id: 10, name: 'Active Family' });
            setupDefaultMocks([family]);
            mockGetFamilyMembers.mockResolvedValue([]);

            await renderAndWait();
            await waitFor(() => {
                expect(screen.getByText('Active Family')).toBeDefined();
            });

            // Enter edit view first
            fireEvent.click(screen.getByText('Active Family'));
            await waitFor(() => {
                expect(screen.getByText('Productos (0)')).toBeDefined();
            });

            // Go back to list and delete the family
            fireEvent.click(screen.getByText(/Volver a la lista/));
            await waitFor(() => {
                expect(screen.getByText('Active Family')).toBeDefined();
            });

            // Now delete
            const deleteBtn = screen.getByTitle('Eliminar familia');
            fireEvent.click(deleteBtn);

            // Wait for ConfirmModal to appear
            await waitFor(() => {
                expect(screen.getByText('Eliminar Familia')).toBeDefined();
            });

            // Click "Eliminar" to confirm deletion
            fireEvent.click(screen.getByText('Eliminar'));

            await waitFor(() => {
                expect(mockDeleteFamily).toHaveBeenCalledWith(10);
                expect(mockListFamilies).toHaveBeenCalled();
            });
        });
    });

    // -----------------------------------------------------------------------
    // 8. Keyboard + Edge cases
    // -----------------------------------------------------------------------

    describe('Keyboard + Edge cases', () => {
        it('Escape key calls onClose', async () => {
            const onClose = vi.fn();
            await renderAndWait(onClose);
            fireEvent.keyDown(document, { key: 'Escape' });
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('handleEditFamily with loadMembers error shows banner but still enters edit view', async () => {
            // loadMembers catches internally and does NOT rethrow, so handleEditFamily
            // proceeds to setView('edit'). The error message from loadMembers is shown.
            const family = makeFamily({ id: 1, name: 'Broken Family' });
            setupDefaultMocks([family]);
            mockGetFamilyMembers.mockRejectedValue(new Error('load failed'));

            await renderAndWait();
            await waitFor(() => {
                expect(screen.getByText('Broken Family')).toBeDefined();
            });

            fireEvent.click(screen.getByText('Broken Family'));

            await waitFor(() => {
                // loadMembers catches and sets this error message
                expect(screen.getByText('Error al cargar miembros')).toBeDefined();
            });

            // Since loadMembers swallows the error, handleEditFamily proceeds to setView('edit')
            // The edit view should be showing (with 0 members since load failed)
            await waitFor(() => {
                expect(screen.getByText('Productos (0)')).toBeDefined();
            });
        });

        it('error banner can be dismissed by clicking X', async () => {
            mockListFamilies.mockRejectedValue(new Error('fail'));
            await renderAndWait();

            await waitFor(() => {
                expect(screen.getByText('Error al cargar familias')).toBeDefined();
            });

            // The error banner has a dismiss X button
            const errorBanner = screen.getByText('Error al cargar familias').closest('div');
            const dismissBtn = errorBanner?.querySelector('button');
            expect(dismissBtn).toBeDefined();

            fireEvent.click(dismissBtn!);

            await waitFor(() => {
                expect(screen.queryByText('Error al cargar familias')).toBeNull();
            });
        });

        it('singular "familia" label when count is 1', async () => {
            mockGetFamilyCount.mockResolvedValue(1);
            await renderAndWait();
            await waitFor(() => {
                expect(screen.getByText('1 familia')).toBeDefined();
            });
        });

        it('description update on blur triggers updateFamily', async () => {
            const family = makeFamily({ id: 5, name: 'My Family', description: 'Old desc' });
            setupDefaultMocks([family]);
            mockGetFamilyMembers.mockResolvedValue([]);

            await renderAndWait();
            await waitFor(() => {
                expect(screen.getByText('My Family')).toBeDefined();
            });
            fireEvent.click(screen.getByText('My Family'));
            await waitFor(() => {
                expect(screen.getByText('Productos (0)')).toBeDefined();
            });

            const descInput = screen.getByPlaceholderText(/Descripción opcional/);
            expect(descInput).toBeDefined();

            fireEvent.change(descInput, { target: { value: 'Updated desc' } });
            fireEvent.blur(descInput);

            await waitFor(() => {
                expect(mockUpdateFamily).toHaveBeenCalledWith(5, {
                    name: 'My Family',
                    description: 'Updated desc',
                });
            });
        });

        it('create form cancel returns to list view', async () => {
            await renderAndWait();
            fireEvent.click(screen.getByText('Nueva'));
            expect(screen.getByText('Nueva Familia')).toBeDefined();

            fireEvent.click(screen.getByText('Cancelar'));

            // Should be back in list view
            expect(screen.getByPlaceholderText('Buscar familia...')).toBeDefined();
            expect(screen.queryByText('Nueva Familia')).toBeNull();
        });

        it('member without descripcion shows fallback text', async () => {
            const member = makeMember({ descripcion: undefined, codigo: 'NODESC' });
            const family = makeFamily();
            setupDefaultMocks([family]);
            mockGetFamilyMembers.mockResolvedValue([member]);

            await renderAndWait();
            fireEvent.click(screen.getByText(family.name));

            await waitFor(() => {
                expect(screen.getByText('NODESC')).toBeDefined();
                expect(screen.getByText(/sin descripción/)).toBeDefined();
            });
        });
    });

    // -----------------------------------------------------------------------
    // 9. Variantes tab
    // -----------------------------------------------------------------------

    describe('Variantes tab', () => {
        async function enterEditView(
            members: ProductFamilyMember[] = [makeMember()],
            family: ProductFamily = makeFamily(),
        ) {
            setupDefaultMocks([family]);
            mockGetFamilyMembers.mockResolvedValue(members);
            await renderAndWait();
            await waitFor(() => {
                expect(screen.getByText(family.name)).toBeDefined();
            });
            fireEvent.click(screen.getByText(family.name));
            await waitFor(() => {
                expect(screen.getByText(`Productos (${members.length})`)).toBeDefined();
            });
        }

        it('should render Variantes tab in edit mode', async () => {
            await enterEditView();
            expect(screen.getByText('Variantes (0)')).toBeDefined();
        });

        it('should switch to Variantes tab and show empty state', async () => {
            await enterEditView();
            fireEvent.click(screen.getByText('Variantes (0)'));
            await waitFor(() => {
                expect(screen.getByText('No hay variantes creadas para esta familia.')).toBeDefined();
            });
        });

        it('should show variant creation form with module checkboxes', async () => {
            await enterEditView();
            fireEvent.click(screen.getByText('Variantes (0)'));
            await waitFor(() => {
                expect(screen.getByText('Crear nueva variante')).toBeDefined();
                expect(screen.getByPlaceholderText(/L0, L1, Izquierdo/)).toBeDefined();
                expect(screen.getByText('Clonar documentos')).toBeDefined();
                // All modules shown as disabled (no masters linked)
                expect(screen.getByText('PFD')).toBeDefined();
                expect(screen.getByText('AMFE')).toBeDefined();
                expect(screen.getByText('Plan de Control')).toBeDefined();
                expect(screen.getByText('Hoja de Operaciones')).toBeDefined();
            });
        });

        it('should disable "Crear variante" button when label is empty', async () => {
            await enterEditView();
            fireEvent.click(screen.getByText('Variantes (0)'));
            await waitFor(() => {
                const createBtn = screen.getByText('Crear variante') as HTMLButtonElement;
                expect(createBtn.closest('button')?.disabled).toBe(true);
            });
        });
    });
});
