/**
 * Database module tests
 *
 * Tests DDL schema creation (indices, tables) and WAL verification logic.
 * Uses the InMemoryAdapter path (isTauri = false) for unit testing.
 */

vi.mock('../../utils/unified_fs', () => ({
    isTauri: vi.fn().mockReturnValue(false),
}));

vi.mock('../../utils/logger', () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { getDatabase, closeDatabase, resetDatabaseForTesting } from '../../utils/database';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('database', () => {
    beforeEach(() => {
        resetDatabaseForTesting();
    });

    afterEach(async () => {
        await closeDatabase();
    });

    describe('getDatabase (InMemory)', () => {
        it('should initialize without error', async () => {
            const db = await getDatabase();
            expect(db).toBeDefined();
            expect(typeof db.execute).toBe('function');
            expect(typeof db.select).toBe('function');
        });

        it('should return the same singleton on subsequent calls', async () => {
            const db1 = await getDatabase();
            const db2 = await getDatabase();
            expect(db1).toBe(db2);
        });
    });

    describe('SCHEMA_DDL — required indices', () => {
        // Read the source file to verify DDL contains expected index statements
        const databaseSource = readFileSync(
            resolve(__dirname, '../../utils/database.ts'),
            'utf-8'
        );

        it('should include idx_amfe_project_name index', () => {
            expect(databaseSource).toContain(
                'CREATE INDEX IF NOT EXISTS idx_amfe_project_name ON amfe_documents(project_name)'
            );
        });

        it('should include idx_cp_linked_amfe_project index', () => {
            expect(databaseSource).toContain(
                'CREATE INDEX IF NOT EXISTS idx_cp_linked_amfe_project ON cp_documents(linked_amfe_project)'
            );
        });

        it('should include idx_ho_linked_amfe_project index', () => {
            expect(databaseSource).toContain(
                'CREATE INDEX IF NOT EXISTS idx_ho_linked_amfe_project ON ho_documents(linked_amfe_project)'
            );
        });

        it('should include existing AMFE indices', () => {
            expect(databaseSource).toContain('idx_amfe_status');
            expect(databaseSource).toContain('idx_amfe_client');
            expect(databaseSource).toContain('idx_amfe_updated');
            expect(databaseSource).toContain('idx_amfe_number');
        });

        it('should include existing CP indices', () => {
            expect(databaseSource).toContain('idx_cp_project_name');
            expect(databaseSource).toContain('idx_cp_client');
            expect(databaseSource).toContain('idx_cp_updated');
            expect(databaseSource).toContain('idx_cp_linked_amfe');
        });

        it('should include existing HO indices', () => {
            expect(databaseSource).toContain('idx_ho_client');
            expect(databaseSource).toContain('idx_ho_updated');
        });

        it('should include PFD indices', () => {
            expect(databaseSource).toContain('idx_pfd_updated');
            expect(databaseSource).toContain('idx_pfd_customer');
        });
    });

    describe('SCHEMA_DDL — comment stripping and statement splitting (regression)', () => {
        // Reproduce the exact pipeline from initializeAdapter() to ensure
        // SQL comments don't filter out CREATE TABLE statements.
        // Bug fixed 2026-03-01: `!s.startsWith('--')` was removing all CREATE TABLE
        // statements because each was preceded by a SQL comment line.

        // Read the source file (same pattern as existing tests above)
        const src = readFileSync(resolve(__dirname, '../../utils/database.ts'), 'utf-8');
        // Extract the SCHEMA_DDL constant from the source
        const ddlMatch = src.match(/const SCHEMA_DDL = `([\s\S]*?)`;/);
        const SCHEMA_DDL = ddlMatch ? ddlMatch[1] : '';

        // Apply the same pipeline as initializeAdapter()
        const statements = SCHEMA_DDL.split(';')
            .map(s => s.trim())
            .map(s => s.replace(/^--[^\n]*\n?/gm, '').trim())
            .filter(s => s.length > 0);

        it('should have extracted SCHEMA_DDL from source', () => {
            expect(SCHEMA_DDL.length).toBeGreaterThan(100);
        });

        it('should preserve all 10 CREATE TABLE statements after comment stripping', () => {
            const createTables = statements.filter(s => s.toUpperCase().startsWith('CREATE TABLE'));
            const tableNames = createTables.map(s => {
                const m = s.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
                return m ? m[1] : 'UNKNOWN';
            });

            expect(tableNames).toContain('schema_version');
            expect(tableNames).toContain('projects');
            expect(tableNames).toContain('amfe_documents');
            expect(tableNames).toContain('amfe_library_operations');
            expect(tableNames).toContain('cp_documents');
            expect(tableNames).toContain('ho_documents');
            expect(tableNames).toContain('pfd_documents');
            expect(tableNames).toContain('drafts');
            expect(tableNames).toContain('settings');
            expect(tableNames).toContain('recent_projects');
            expect(tableNames).toContain('document_revisions');
            expect(tableNames).toContain('cross_doc_checks');
            expect(tableNames).toContain('solicitud_documents');
            expect(tableNames).toContain('products');
            expect(tableNames).toContain('customer_lines');
            expect(tableNames).toContain('product_families');
            expect(tableNames).toContain('product_family_members');
            expect(tableNames).toContain('pending_exports');
            expect(tableNames).toContain('document_locks');
            expect(createTables).toHaveLength(19);
        });

        it('should preserve all CREATE INDEX statements', () => {
            const createIndexes = statements.filter(s => s.toUpperCase().startsWith('CREATE INDEX'));
            // At least 14 indexes across all tables
            expect(createIndexes.length).toBeGreaterThanOrEqual(14);
            // Verify key indexes are present
            const indexSql = createIndexes.join('\n');
            expect(indexSql).toContain('idx_projects_client');
            expect(indexSql).toContain('idx_amfe_status');
            expect(indexSql).toContain('idx_cp_project_name');
            expect(indexSql).toContain('idx_ho_client');
            expect(indexSql).toContain('idx_pfd_updated');
        });

        it('should not produce empty statements', () => {
            for (const stmt of statements) {
                expect(stmt.length).toBeGreaterThan(0);
                // No statement should be only whitespace or comments
                expect(stmt.trim()).not.toBe('');
                expect(stmt.trim()).not.toMatch(/^--/);
            }
        });

        it('should have CREATE TABLE before its CREATE INDEX (execution order)', () => {
            // For each table with indexes, verify the CREATE TABLE comes first
            const tablesToCheck = ['projects', 'amfe_documents', 'cp_documents', 'ho_documents'];

            for (const table of tablesToCheck) {
                const createTableIdx = statements.findIndex(s =>
                    s.toUpperCase().includes(`CREATE TABLE`) && s.includes(table)
                );
                const firstIndexIdx = statements.findIndex(s =>
                    s.toUpperCase().includes(`CREATE INDEX`) && s.includes(table)
                );

                expect(createTableIdx).toBeGreaterThanOrEqual(0);
                expect(firstIndexIdx).toBeGreaterThanOrEqual(0);
                expect(createTableIdx).toBeLessThan(firstIndexIdx);
            }
        });
    });

    describe('closeDatabase', () => {
        it('should allow re-initialization after close', async () => {
            const db1 = await getDatabase();
            await closeDatabase();
            const db2 = await getDatabase();
            expect(db2).toBeDefined();
            // After close + re-init, should be a new instance
            expect(db1).not.toBe(db2);
        });
    });

    describe('InMemoryAdapter — family repository operations', () => {
        beforeEach(() => {
            resetDatabaseForTesting();
        });
        afterEach(async () => {
            await closeDatabase();
        });

        // 1. INSERT applies default values for missing columns
        it('INSERT should apply table defaults for missing columns', async () => {
            const db = await getDatabase();
            await db.execute(
                "INSERT INTO product_families (name, description, linea_code, linea_name) VALUES (?, ?, ?, ?)",
                ['Test Family', 'desc', '', '']
            );
            const rows = await db.select<Record<string, unknown>>(
                "SELECT * FROM product_families WHERE name = ?", ['Test Family']
            );
            expect(rows).toHaveLength(1);
            expect(rows[0].active).toBe(1); // Default value applied
            expect(rows[0].name).toBe('Test Family');
        });

        // 2. INSERT OR IGNORE respects composite UNIQUE
        it('INSERT OR IGNORE should reject duplicate (family_id, product_id)', async () => {
            const db = await getDatabase();
            // Create family and product first
            await db.execute("INSERT INTO product_families (name) VALUES (?)", ['Fam1']);
            await db.execute("INSERT INTO products (codigo, descripcion, linea_code, linea_name) VALUES (?, ?, ?, ?)",
                ['P001', 'Product 1', '001', 'Line 1']);

            // Add member first time
            await db.execute("INSERT OR IGNORE INTO product_family_members (family_id, product_id, is_primary) VALUES (?, ?, ?)",
                [1, 1, 0]);
            // Add same member again (should be ignored)
            await db.execute("INSERT OR IGNORE INTO product_family_members (family_id, product_id, is_primary) VALUES (?, ?, ?)",
                [1, 1, 0]);

            const rows = await db.select<Record<string, unknown>>(
                "SELECT * FROM product_family_members WHERE family_id = ?", [1]
            );
            expect(rows).toHaveLength(1); // Only one row
        });

        // 3. SELECT with table alias in WHERE
        it('SELECT should filter with table-aliased column names', async () => {
            const db = await getDatabase();
            await db.execute("INSERT INTO product_families (name) VALUES (?)", ['Active Fam']);
            // active defaults to 1
            const rows = await db.select<Record<string, unknown>>(
                "SELECT pf.* FROM product_families pf WHERE pf.active = 1"
            );
            expect(rows).toHaveLength(1);
            expect(rows[0].name).toBe('Active Fam');
        });

        // 4. SELECT with JOIN merges columns
        it('SELECT with JOIN should merge product data into member rows', async () => {
            const db = await getDatabase();
            await db.execute("INSERT INTO product_families (name) VALUES (?)", ['JoinFam']);
            await db.execute("INSERT INTO products (codigo, descripcion, linea_code, linea_name) VALUES (?, ?, ?, ?)",
                ['ABC', 'Widget', '001', 'LineA']);
            await db.execute("INSERT INTO product_family_members (family_id, product_id, is_primary) VALUES (?, ?, ?)",
                [1, 1, 1]);

            const rows = await db.select<Record<string, unknown>>(
                `SELECT pfm.*, p.codigo, p.descripcion, p.linea_code, p.linea_name
                 FROM product_family_members pfm
                 JOIN products p ON pfm.product_id = p.id
                 WHERE pfm.family_id = ?
                 ORDER BY pfm.is_primary DESC, p.codigo`,
                [1]
            );
            expect(rows).toHaveLength(1);
            expect(rows[0].family_id).toBe(1);
            expect(rows[0].product_id).toBe(1);
            expect(rows[0].codigo).toBe('ABC');
            expect(rows[0].descripcion).toBe('Widget');
            expect(rows[0].is_primary).toBe(1);
        });

        // 5. Subquery COUNT evaluation
        it('SELECT with subquery COUNT should compute member_count', async () => {
            const db = await getDatabase();
            await db.execute("INSERT INTO product_families (name) VALUES (?)", ['CountFam']);
            await db.execute("INSERT INTO products (codigo, descripcion, linea_code, linea_name) VALUES (?, ?, ?, ?)",
                ['P1', 'Prod1', '001', 'L1']);
            await db.execute("INSERT INTO products (codigo, descripcion, linea_code, linea_name) VALUES (?, ?, ?, ?)",
                ['P2', 'Prod2', '001', 'L1']);
            await db.execute("INSERT INTO product_family_members (family_id, product_id, is_primary) VALUES (?, ?, ?)",
                [1, 1, 1]);
            await db.execute("INSERT INTO product_family_members (family_id, product_id, is_primary) VALUES (?, ?, ?)",
                [1, 2, 0]);

            const rows = await db.select<Record<string, unknown>>(
                `SELECT pf.*,
                    (SELECT COUNT(*) FROM product_family_members WHERE family_id = pf.id) as member_count
                 FROM product_families pf
                 WHERE pf.active = 1`
            );
            expect(rows).toHaveLength(1);
            expect(rows[0].member_count).toBe(2);
        });

        // 6. UPDATE with multi-column WHERE
        it('UPDATE should match multi-column WHERE conditions', async () => {
            const db = await getDatabase();
            await db.execute("INSERT INTO product_families (name) VALUES (?)", ['UpdateFam']);
            await db.execute("INSERT INTO products (codigo, descripcion, linea_code, linea_name) VALUES (?, ?, ?, ?)",
                ['P1', 'Prod', '001', 'L']);
            await db.execute("INSERT INTO product_family_members (family_id, product_id, is_primary) VALUES (?, ?, ?)",
                [1, 1, 0]);

            // Set as primary (this is what setFamilyPrimary does)
            await db.execute("UPDATE product_family_members SET is_primary = 0 WHERE family_id = ?", [1]);
            await db.execute("UPDATE product_family_members SET is_primary = 1 WHERE family_id = ? AND product_id = ?",
                [1, 1]);

            const rows = await db.select<Record<string, unknown>>(
                "SELECT * FROM product_family_members WHERE family_id = ?", [1]
            );
            expect(rows).toHaveLength(1);
            expect(rows[0].is_primary).toBe(1);
        });

        // 7. UPDATE with single-column WHERE updates multiple rows
        it('UPDATE should update all matching rows', async () => {
            const db = await getDatabase();
            await db.execute("INSERT INTO product_families (name) VALUES (?)", ['MultiUpdate']);
            await db.execute("INSERT INTO products (codigo, descripcion, linea_code, linea_name) VALUES (?, ?, ?, ?)",
                ['P1', 'Prod1', '001', 'L']);
            await db.execute("INSERT INTO products (codigo, descripcion, linea_code, linea_name) VALUES (?, ?, ?, ?)",
                ['P2', 'Prod2', '001', 'L']);
            await db.execute("INSERT INTO product_family_members (family_id, product_id, is_primary) VALUES (?, ?, ?)",
                [1, 1, 1]);
            await db.execute("INSERT INTO product_family_members (family_id, product_id, is_primary) VALUES (?, ?, ?)",
                [1, 2, 1]);

            // Unset all primary flags for family 1
            const result = await db.execute("UPDATE product_family_members SET is_primary = 0 WHERE family_id = ?", [1]);
            expect(result.rowsAffected).toBe(2);

            const rows = await db.select<Record<string, unknown>>(
                "SELECT * FROM product_family_members WHERE family_id = ?", [1]
            );
            expect(rows.every(r => r.is_primary === 0)).toBe(true);
        });

        // 8. DELETE with multi-column WHERE
        it('DELETE should match multi-column WHERE conditions', async () => {
            const db = await getDatabase();
            await db.execute("INSERT INTO product_families (name) VALUES (?)", ['DeleteFam']);
            await db.execute("INSERT INTO products (codigo, descripcion, linea_code, linea_name) VALUES (?, ?, ?, ?)",
                ['P1', 'Prod1', '001', 'L']);
            await db.execute("INSERT INTO products (codigo, descripcion, linea_code, linea_name) VALUES (?, ?, ?, ?)",
                ['P2', 'Prod2', '001', 'L']);
            await db.execute("INSERT INTO product_family_members (family_id, product_id, is_primary) VALUES (?, ?, ?)",
                [1, 1, 0]);
            await db.execute("INSERT INTO product_family_members (family_id, product_id, is_primary) VALUES (?, ?, ?)",
                [1, 2, 0]);

            // Delete specific member (family_id=1 AND product_id=1)
            const result = await db.execute(
                "DELETE FROM product_family_members WHERE family_id = ? AND product_id = ?", [1, 1]
            );
            expect(result.rowsAffected).toBe(1);

            const remaining = await db.select<Record<string, unknown>>(
                "SELECT * FROM product_family_members WHERE family_id = ?", [1]
            );
            expect(remaining).toHaveLength(1);
            expect(remaining[0].product_id).toBe(2);
        });

        // 9. DELETE without bindings clears all rows
        it('DELETE without WHERE should clear all rows', async () => {
            const db = await getDatabase();
            await db.execute("INSERT INTO product_families (name) VALUES (?)", ['F1']);
            await db.execute("INSERT INTO product_families (name) VALUES (?)", ['F2']);

            const result = await db.execute("DELETE FROM product_families");
            expect(result.rowsAffected).toBe(2);
        });

        // 10. LEFT JOIN preserves rows without matches
        it('LEFT JOIN should preserve rows without match in joined table', async () => {
            const db = await getDatabase();
            await db.execute("INSERT INTO products (codigo, descripcion, linea_code, linea_name) VALUES (?, ?, ?, ?)",
                ['ORPHAN', 'Orphan Product', '001', 'L']);
            // No family membership for this product

            const rows = await db.select<Record<string, unknown>>(
                `SELECT p.id, p.codigo, p.descripcion, p.linea_code, p.linea_name
                 FROM products p
                 LEFT JOIN product_family_members pfm ON p.id = pfm.product_id
                 WHERE p.active = 1 AND pfm.id IS NULL
                 ORDER BY p.linea_code, p.codigo`
            );
            expect(rows).toHaveLength(1);
            expect(rows[0].codigo).toBe('ORPHAN');
        });

        // 11. IS NULL condition
        it('IS NULL should match rows with null/undefined values', async () => {
            const db = await getDatabase();
            await db.execute("INSERT INTO products (codigo, descripcion, linea_code, linea_name) VALUES (?, ?, ?, ?)",
                ['P1', 'Prod', '001', 'L']);

            // LEFT JOIN with no matching members → pfm.id is undefined (treated as NULL)
            const rows = await db.select<Record<string, unknown>>(
                `SELECT p.*
                 FROM products p
                 LEFT JOIN product_family_members pfm ON p.id = pfm.product_id
                 WHERE pfm.id IS NULL`
            );
            expect(rows).toHaveLength(1);
            expect(rows[0].codigo).toBe('P1');
        });

        // 12. getFamilyCount returns correct count
        it('getFamilyCount-style query returns correct count after insert', async () => {
            const db = await getDatabase();
            await db.execute("INSERT INTO product_families (name) VALUES (?)", ['Fam1']);
            await db.execute("INSERT INTO product_families (name) VALUES (?)", ['Fam2']);

            const rows = await db.select<{ cnt: number }>(
                "SELECT COUNT(*) as cnt FROM product_families WHERE active = 1"
            );
            expect(rows[0].cnt).toBe(2);
        });

        // 13. ORDER BY with table alias
        it('ORDER BY with table alias should work', async () => {
            const db = await getDatabase();
            await db.execute("INSERT INTO products (codigo, descripcion, linea_code, linea_name) VALUES (?, ?, ?, ?)",
                ['ZZZ', 'Last', '001', 'L']);
            await db.execute("INSERT INTO products (codigo, descripcion, linea_code, linea_name) VALUES (?, ?, ?, ?)",
                ['AAA', 'First', '001', 'L']);

            const rows = await db.select<Record<string, unknown>>(
                "SELECT * FROM products ORDER BY codigo"
            );
            expect(rows[0].codigo).toBe('AAA');
            expect(rows[1].codigo).toBe('ZZZ');
        });

        // 14. LIKE with table alias
        it('LIKE with table alias should filter correctly', async () => {
            const db = await getDatabase();
            await db.execute("INSERT INTO product_families (name, description) VALUES (?, ?)", ['Alpha Family', 'desc']);
            await db.execute("INSERT INTO product_families (name, description) VALUES (?, ?)", ['Beta Family', 'desc']);

            const rows = await db.select<Record<string, unknown>>(
                "SELECT pf.* FROM product_families pf WHERE (pf.name LIKE ? OR pf.description LIKE ?) AND pf.active = 1",
                ['%Alpha%', '%Alpha%']
            );
            expect(rows).toHaveLength(1);
            expect(rows[0].name).toBe('Alpha Family');
        });

        // 15. UPDATE with CASE WHEN (atomic setFamilyPrimary)
        it('UPDATE with CASE WHEN should set one row and unset others atomically', async () => {
            const db = await getDatabase();
            await db.execute("INSERT INTO product_families (name) VALUES (?)", ['CaseFam']);
            await db.execute("INSERT INTO products (codigo, descripcion, linea_code, linea_name) VALUES (?, ?, ?, ?)",
                ['C1', 'Case1', '001', 'L']);
            await db.execute("INSERT INTO products (codigo, descripcion, linea_code, linea_name) VALUES (?, ?, ?, ?)",
                ['C2', 'Case2', '001', 'L']);
            await db.execute("INSERT INTO products (codigo, descripcion, linea_code, linea_name) VALUES (?, ?, ?, ?)",
                ['C3', 'Case3', '001', 'L']);
            await db.execute("INSERT INTO product_family_members (family_id, product_id, is_primary) VALUES (?, ?, ?)",
                [1, 1, 1]); // initially primary
            await db.execute("INSERT INTO product_family_members (family_id, product_id, is_primary) VALUES (?, ?, ?)",
                [1, 2, 0]);
            await db.execute("INSERT INTO product_family_members (family_id, product_id, is_primary) VALUES (?, ?, ?)",
                [1, 3, 0]);

            // Atomic: set product_id=2 as primary, unset all others
            const result = await db.execute(
                `UPDATE product_family_members
                 SET is_primary = CASE WHEN product_id = ? THEN 1 ELSE 0 END
                 WHERE family_id = ?`,
                [2, 1]
            );
            expect(result.rowsAffected).toBe(3); // All 3 rows matched WHERE

            const rows = await db.select<Record<string, unknown>>(
                "SELECT product_id, is_primary FROM product_family_members WHERE family_id = ? ORDER BY product_id",
                [1]
            );
            expect(rows).toHaveLength(3);
            expect(rows[0]).toMatchObject({ product_id: 1, is_primary: 0 }); // was 1, now 0
            expect(rows[1]).toMatchObject({ product_id: 2, is_primary: 1 }); // was 0, now 1
            expect(rows[2]).toMatchObject({ product_id: 3, is_primary: 0 }); // unchanged
        });

        // 16. Full family workflow (end-to-end)
        it('full family workflow: create, add members, set primary, remove', async () => {
            const db = await getDatabase();

            // Create family
            const createResult = await db.execute(
                "INSERT INTO product_families (name, description, linea_code, linea_name) VALUES (?, ?, ?, ?)",
                ['E2E Family', 'end-to-end test', '', '']
            );
            expect(createResult.lastInsertId).toBeGreaterThan(0);
            const familyId = createResult.lastInsertId;

            // Create products
            await db.execute("INSERT INTO products (codigo, descripcion, linea_code, linea_name) VALUES (?, ?, ?, ?)",
                ['E2E-001', 'Part A', '010', 'E2E Line']);
            await db.execute("INSERT INTO products (codigo, descripcion, linea_code, linea_name) VALUES (?, ?, ?, ?)",
                ['E2E-002', 'Part B', '010', 'E2E Line']);

            // Add members
            await db.execute("INSERT OR IGNORE INTO product_family_members (family_id, product_id, is_primary) VALUES (?, ?, ?)",
                [familyId, 1, 1]);
            await db.execute("INSERT OR IGNORE INTO product_family_members (family_id, product_id, is_primary) VALUES (?, ?, ?)",
                [familyId, 2, 0]);

            // Verify members with JOIN
            const members = await db.select<Record<string, unknown>>(
                `SELECT pfm.*, p.codigo, p.descripcion
                 FROM product_family_members pfm
                 JOIN products p ON pfm.product_id = p.id
                 WHERE pfm.family_id = ?
                 ORDER BY pfm.is_primary DESC`,
                [familyId]
            );
            expect(members).toHaveLength(2);
            expect(members[0].codigo).toBe('E2E-001');
            expect(members[0].is_primary).toBe(1);
            expect(members[1].codigo).toBe('E2E-002');

            // Set primary to second product
            await db.execute("UPDATE product_family_members SET is_primary = 0 WHERE family_id = ?", [familyId]);
            await db.execute("UPDATE product_family_members SET is_primary = 1 WHERE family_id = ? AND product_id = ?",
                [familyId, 2]);

            const afterPrimary = await db.select<Record<string, unknown>>(
                "SELECT * FROM product_family_members WHERE family_id = ? AND is_primary = 1", [familyId]
            );
            expect(afterPrimary).toHaveLength(1);
            expect(afterPrimary[0].product_id).toBe(2);

            // Remove first product
            await db.execute("DELETE FROM product_family_members WHERE family_id = ? AND product_id = ?",
                [familyId, 1]);

            const afterRemove = await db.select<Record<string, unknown>>(
                "SELECT * FROM product_family_members WHERE family_id = ?", [familyId]
            );
            expect(afterRemove).toHaveLength(1);

            // Verify count subquery
            const familyWithCount = await db.select<Record<string, unknown>>(
                `SELECT pf.*,
                    (SELECT COUNT(*) FROM product_family_members WHERE family_id = pf.id) as member_count
                 FROM product_families pf WHERE pf.id = ?`,
                [familyId]
            );
            expect(familyWithCount[0].member_count).toBe(1);
        });
    });
});
