/**
 * Family Repository
 *
 * CRUD for product families — groups of products that share a manufacturing process.
 * Families can span multiple customer lines (cross-line allowed).
 * M:N relationship via product_family_members join table.
 */

import { getDatabase } from '../database';
import { logger } from '../logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProductFamily {
    id: number;
    name: string;
    description: string;
    lineaCode: string;
    lineaName: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
    memberCount?: number;
}

export interface ProductFamilyMember {
    id: number;
    familyId: number;
    productId: number;
    isPrimary: boolean;
    addedAt: string;
    // Joined from products table
    codigo?: string;
    descripcion?: string;
    lineaCode?: string;
    lineaName?: string;
}

interface FamilyRow {
    id: number;
    name: string;
    description: string;
    linea_code: string;
    linea_name: string;
    active: number;
    created_at: string;
    updated_at: string;
    member_count?: number;
}

interface MemberRow {
    id: number;
    family_id: number;
    product_id: number;
    is_primary: number;
    added_at: string;
    codigo?: string;
    descripcion?: string;
    linea_code?: string;
    linea_name?: string;
}

function rowToFamily(row: FamilyRow): ProductFamily {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        lineaCode: row.linea_code,
        lineaName: row.linea_name,
        active: row.active === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        memberCount: row.member_count,
    };
}

function rowToMember(row: MemberRow): ProductFamilyMember {
    return {
        id: row.id,
        familyId: row.family_id,
        productId: row.product_id,
        isPrimary: row.is_primary === 1,
        addedAt: row.added_at ?? '',
        codigo: row.codigo ?? undefined,
        descripcion: row.descripcion ?? undefined,
        lineaCode: row.linea_code ?? undefined,
        lineaName: row.linea_name ?? undefined,
    };
}

// ---------------------------------------------------------------------------
// Family CRUD
// ---------------------------------------------------------------------------

/**
 * List all families, optionally filtered.
 */
export async function listFamilies(options?: {
    search?: string;
    lineaCode?: string;
    activeOnly?: boolean;
    limit?: number;
}): Promise<ProductFamily[]> {
    const db = await getDatabase();
    const conditions: string[] = [];
    const bindings: unknown[] = [];

    if (options?.activeOnly !== false) {
        conditions.push('pf.active = 1');
    }
    if (options?.lineaCode) {
        conditions.push('pf.linea_code = ?');
        bindings.push(options.lineaCode);
    }
    if (options?.search) {
        conditions.push('(pf.name LIKE ? OR pf.description LIKE ?)');
        const term = `%${options.search}%`;
        bindings.push(term, term);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = options?.limit ? `LIMIT ${options.limit}` : '';

    const rows = await db.select<FamilyRow>(
        `SELECT pf.*,
            (SELECT COUNT(*) FROM product_family_members WHERE family_id = pf.id) as member_count
         FROM product_families pf
         ${where}
         ORDER BY pf.name
         ${limit}`,
        bindings
    );
    return rows.map(rowToFamily);
}

/**
 * Get a single family by ID.
 */
export async function getFamilyById(id: number): Promise<ProductFamily | null> {
    const db = await getDatabase();
    const rows = await db.select<FamilyRow>(
        `SELECT pf.*,
            (SELECT COUNT(*) FROM product_family_members WHERE family_id = pf.id) as member_count
         FROM product_families pf
         WHERE pf.id = ?`,
        [id]
    );
    return rows.length > 0 ? rowToFamily(rows[0]) : null;
}

/**
 * Get a family by name.
 */
export async function getFamilyByName(name: string): Promise<ProductFamily | null> {
    const db = await getDatabase();
    const rows = await db.select<FamilyRow>(
        `SELECT pf.*,
            (SELECT COUNT(*) FROM product_family_members WHERE family_id = pf.id) as member_count
         FROM product_families pf
         WHERE pf.name = ?`,
        [name]
    );
    return rows.length > 0 ? rowToFamily(rows[0]) : null;
}

/**
 * Create a new family. Returns the inserted ID.
 */
export async function createFamily(family: {
    name: string;
    description?: string;
    lineaCode?: string;
    lineaName?: string;
}): Promise<number> {
    const db = await getDatabase();
    const result = await db.execute(
        `INSERT INTO product_families (name, description, linea_code, linea_name)
         VALUES (?, ?, ?, ?)`,
        [
            family.name,
            family.description ?? '',
            family.lineaCode ?? '',
            family.lineaName ?? '',
        ]
    );
    logger.info('FamilyRepository', 'Family created', { name: family.name, id: result.lastInsertId });
    return result.lastInsertId;
}

/**
 * Update a family.
 */
export async function updateFamily(id: number, fields: {
    name?: string;
    description?: string;
    lineaCode?: string;
    lineaName?: string;
    active?: boolean;
}): Promise<void> {
    const db = await getDatabase();
    const sets: string[] = [];
    const bindings: unknown[] = [];

    if (fields.name !== undefined) {
        sets.push('name = ?');
        bindings.push(fields.name);
    }
    if (fields.description !== undefined) {
        sets.push('description = ?');
        bindings.push(fields.description);
    }
    if (fields.lineaCode !== undefined) {
        sets.push('linea_code = ?');
        bindings.push(fields.lineaCode);
    }
    if (fields.lineaName !== undefined) {
        sets.push('linea_name = ?');
        bindings.push(fields.lineaName);
    }
    if (fields.active !== undefined) {
        sets.push('active = ?');
        bindings.push(fields.active ? 1 : 0);
    }

    if (sets.length === 0) return;

    sets.push("updated_at = datetime('now')");
    bindings.push(id);

    await db.execute(
        `UPDATE product_families SET ${sets.join(', ')} WHERE id = ?`,
        bindings
    );
}

/**
 * Delete a family and its members.
 * Manual cascade (members first) because SQLite FK CASCADE is not enforced in all
 * modes, and InMemoryAdapter does not implement CASCADE at all.
 */
export async function deleteFamily(id: number): Promise<void> {
    const db = await getDatabase();
    try {
        await db.execute('DELETE FROM product_family_members WHERE family_id = ?', [id]);
    } catch (err) {
        logger.warn('FamilyRepository', 'Failed to delete members before family', { id, err });
        // Continue — the family delete is the critical operation
    }
    await db.execute('DELETE FROM product_families WHERE id = ?', [id]);
    logger.info('FamilyRepository', 'Family deleted', { id });
}

/**
 * Get total count of active families.
 */
export async function getFamilyCount(): Promise<number> {
    const db = await getDatabase();
    const rows = await db.select<{ cnt: number }>(
        'SELECT COUNT(*) as cnt FROM product_families WHERE active = 1'
    );
    return rows[0]?.cnt ?? 0;
}

// ---------------------------------------------------------------------------
// Family Members
// ---------------------------------------------------------------------------

/**
 * Get all members of a family with joined product data.
 */
export async function getFamilyMembers(familyId: number): Promise<ProductFamilyMember[]> {
    const db = await getDatabase();
    const rows = await db.select<MemberRow>(
        `SELECT pfm.*, p.codigo, p.descripcion, p.linea_code, p.linea_name
         FROM product_family_members pfm
         JOIN products p ON pfm.product_id = p.id
         WHERE pfm.family_id = ?
         ORDER BY pfm.is_primary DESC, p.codigo`,
        [familyId]
    );
    return rows.map(rowToMember);
}

/**
 * Add a product to a family.
 */
export async function addFamilyMember(familyId: number, productId: number, isPrimary = false): Promise<void> {
    const db = await getDatabase();
    await db.execute(
        `INSERT OR IGNORE INTO product_family_members (family_id, product_id, is_primary)
         VALUES (?, ?, ?)`,
        [familyId, productId, isPrimary ? 1 : 0]
    );
}

/**
 * Remove a product from a family.
 */
export async function removeFamilyMember(familyId: number, productId: number): Promise<void> {
    const db = await getDatabase();
    await db.execute(
        'DELETE FROM product_family_members WHERE family_id = ? AND product_id = ?',
        [familyId, productId]
    );
}

/**
 * Set one product as the primary member of a family (unsets others).
 * Uses a single UPDATE with CASE to be atomic — no intermediate state without a primary.
 */
export async function setFamilyPrimary(familyId: number, productId: number): Promise<void> {
    const db = await getDatabase();
    await db.execute(
        `UPDATE product_family_members
         SET is_primary = CASE WHEN product_id = ? THEN 1 ELSE 0 END
         WHERE family_id = ?`,
        [productId, familyId]
    );
}

// ---------------------------------------------------------------------------
// Cross-reference queries
// ---------------------------------------------------------------------------

/**
 * Get all families that contain a specific product (by product code + line).
 */
export async function getFamiliesByProductCode(codigo: string, lineaCode: string): Promise<ProductFamily[]> {
    const db = await getDatabase();
    const rows = await db.select<FamilyRow>(
        `SELECT pf.*,
            (SELECT COUNT(*) FROM product_family_members WHERE family_id = pf.id) as member_count
         FROM product_families pf
         JOIN product_family_members pfm ON pf.id = pfm.family_id
         JOIN products p ON pfm.product_id = p.id
         WHERE p.codigo = ? AND p.linea_code = ? AND pf.active = 1`,
        [codigo, lineaCode]
    );
    return rows.map(rowToFamily);
}

/**
 * Get all families that contain a specific product (by product ID).
 */
export async function getFamiliesForProduct(productId: number): Promise<ProductFamily[]> {
    const db = await getDatabase();
    const rows = await db.select<FamilyRow>(
        `SELECT pf.*,
            (SELECT COUNT(*) FROM product_family_members WHERE family_id = pf.id) as member_count
         FROM product_families pf
         JOIN product_family_members pfm ON pf.id = pfm.family_id
         WHERE pfm.product_id = ? AND pf.active = 1`,
        [productId]
    );
    return rows.map(rowToFamily);
}

/**
 * Get products that are NOT in any family.
 */
export async function getOrphanProducts(options?: {
    lineaCode?: string;
    limit?: number;
}): Promise<Array<{ id: number; codigo: string; descripcion: string; lineaCode: string; lineaName: string }>> {
    const db = await getDatabase();
    const conditions = ['p.active = 1'];
    const bindings: unknown[] = [];

    if (options?.lineaCode) {
        conditions.push('p.linea_code = ?');
        bindings.push(options.lineaCode);
    }

    const where = conditions.join(' AND ');
    const limit = options?.limit ? `LIMIT ${options.limit}` : '';

    const rows = await db.select<{
        id: number;
        codigo: string;
        descripcion: string;
        linea_code: string;
        linea_name: string;
    }>(
        `SELECT p.id, p.codigo, p.descripcion, p.linea_code, p.linea_name
         FROM products p
         LEFT JOIN product_family_members pfm ON p.id = pfm.product_id
         WHERE ${where} AND pfm.id IS NULL
         ORDER BY p.linea_code, p.codigo
         ${limit}`,
        bindings
    );

    return rows.map(r => ({
        id: r.id,
        codigo: r.codigo,
        descripcion: r.descripcion,
        lineaCode: r.linea_code,
        lineaName: r.linea_name,
    }));
}
