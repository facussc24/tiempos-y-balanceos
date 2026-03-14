/**
 * Product Repository
 *
 * CRUD for the product catalog (articles from Barack Argentina SRL).
 * Products are organized by customer line (Línea).
 * Supports search, filtering by line, and seeding from static data.
 */

import { getDatabase } from '../database';
import { logger } from '../logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Product {
    id: number;
    codigo: string;
    descripcion: string;
    lineaCode: string;
    lineaName: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CustomerLine {
    id: number;
    code: string;
    name: string;
    productCount: number;
    isAutomotive: boolean;
    active: boolean;
    createdAt: string;
}

interface ProductRow {
    id: number;
    codigo: string;
    descripcion: string;
    linea_code: string;
    linea_name: string;
    active: number;
    created_at: string;
    updated_at: string;
}

interface CustomerLineRow {
    id: number;
    code: string;
    name: string;
    product_count: number;
    is_automotive: number;
    active: number;
    created_at: string;
}

function rowToProduct(row: ProductRow): Product {
    return {
        id: row.id,
        codigo: row.codigo,
        descripcion: row.descripcion,
        lineaCode: row.linea_code,
        lineaName: row.linea_name,
        active: row.active === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function rowToCustomerLine(row: CustomerLineRow): CustomerLine {
    return {
        id: row.id,
        code: row.code,
        name: row.name,
        productCount: row.product_count,
        isAutomotive: row.is_automotive === 1,
        active: row.active === 1,
        createdAt: row.created_at,
    };
}

// ---------------------------------------------------------------------------
// Product CRUD
// ---------------------------------------------------------------------------

/**
 * Get total product count.
 */
export async function getProductCount(): Promise<number> {
    const db = await getDatabase();
    const rows = await db.select<{ cnt: number }>('SELECT COUNT(*) as cnt FROM products');
    return rows[0]?.cnt ?? 0;
}

/**
 * List all products, optionally filtered.
 */
export async function listProducts(options?: {
    lineaCode?: string;
    search?: string;
    activeOnly?: boolean;
    limit?: number;
    offset?: number;
}): Promise<Product[]> {
    const db = await getDatabase();
    const conditions: string[] = [];
    const bindings: unknown[] = [];

    if (options?.activeOnly !== false) {
        conditions.push('active = 1');
    }
    if (options?.lineaCode) {
        conditions.push('linea_code = ?');
        bindings.push(options.lineaCode);
    }
    if (options?.search) {
        conditions.push('(codigo LIKE ? OR descripcion LIKE ?)');
        const term = `%${options.search}%`;
        bindings.push(term, term);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = options?.limit ? `LIMIT ${options.limit}` : '';
    const offset = options?.offset ? `OFFSET ${options.offset}` : '';

    const rows = await db.select<ProductRow>(
        `SELECT * FROM products ${where} ORDER BY linea_code, codigo ${limit} ${offset}`,
        bindings
    );
    return rows.map(rowToProduct);
}

/**
 * Get a product by code and line.
 */
export async function getProductByCode(codigo: string, lineaCode: string): Promise<Product | null> {
    const db = await getDatabase();
    const rows = await db.select<ProductRow>(
        'SELECT * FROM products WHERE codigo = ? AND linea_code = ?',
        [codigo, lineaCode]
    );
    return rows.length > 0 ? rowToProduct(rows[0]) : null;
}

/**
 * Search products by text (codigo or description).
 */
export async function searchProducts(query: string, limit = 50): Promise<Product[]> {
    const db = await getDatabase();
    const term = `%${query}%`;
    const rows = await db.select<ProductRow>(
        'SELECT * FROM products WHERE active = 1 AND (codigo LIKE ? OR descripcion LIKE ?) ORDER BY linea_code, codigo LIMIT ?',
        [term, term, limit]
    );
    return rows.map(rowToProduct);
}

/**
 * Insert a single product (upsert by codigo + linea_code).
 */
export async function upsertProduct(product: {
    codigo: string;
    descripcion: string;
    lineaCode: string;
    lineaName: string;
}): Promise<void> {
    const db = await getDatabase();
    await db.execute(
        `INSERT OR REPLACE INTO products (codigo, descripcion, linea_code, linea_name, active, updated_at)
         VALUES (?, ?, ?, ?, 1, datetime('now'))`,
        [product.codigo, product.descripcion, product.lineaCode, product.lineaName]
    );
}

// ---------------------------------------------------------------------------
// Customer Line CRUD
// ---------------------------------------------------------------------------

/**
 * List all customer lines.
 */
export async function listCustomerLines(options?: {
    automotiveOnly?: boolean;
    activeOnly?: boolean;
}): Promise<CustomerLine[]> {
    const db = await getDatabase();
    const conditions: string[] = [];

    if (options?.activeOnly !== false) {
        conditions.push('active = 1');
    }
    if (options?.automotiveOnly) {
        conditions.push('is_automotive = 1');
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await db.select<CustomerLineRow>(
        `SELECT * FROM customer_lines ${where} ORDER BY name`,
    );
    return rows.map(rowToCustomerLine);
}

/**
 * Get products for a specific customer line.
 */
export async function getProductsByLine(lineaCode: string): Promise<Product[]> {
    return listProducts({ lineaCode, activeOnly: true });
}

// ---------------------------------------------------------------------------
// Seed / Bulk operations
// ---------------------------------------------------------------------------

/**
 * Check if the product catalog has been seeded.
 */
export async function isProductCatalogSeeded(): Promise<boolean> {
    const count = await getProductCount();
    return count > 0;
}

/**
 * Seed the product catalog from static data.
 * Skips if already seeded (idempotent).
 */
export async function seedProductCatalog(
    products: Array<{ codigo: string; descripcion: string; lineaCode: string; lineaName: string }>,
    customerLines: Array<{ code: string; name: string; productCount: number; isAutomotive: boolean }>
): Promise<{ productsInserted: number; linesInserted: number }> {
    const db = await getDatabase();

    // Check if already seeded
    const existing = await getProductCount();
    if (existing > 0) {
        logger.info('ProductRepository', 'Catalog already seeded', { existing });
        return { productsInserted: 0, linesInserted: 0 };
    }

    logger.info('ProductRepository', 'Seeding product catalog', {
        products: products.length,
        lines: customerLines.length,
    });

    // Insert customer lines
    let linesInserted = 0;
    for (const line of customerLines) {
        try {
            await db.execute(
                `INSERT OR IGNORE INTO customer_lines (code, name, product_count, is_automotive, active)
                 VALUES (?, ?, ?, ?, 1)`,
                [line.code, line.name, line.productCount, line.isAutomotive ? 1 : 0]
            );
            linesInserted++;
        } catch (err) {
            logger.warn('ProductRepository', `Failed to insert line: ${line.code}`, { error: String(err) });
        }
    }

    // Insert products in batches
    let productsInserted = 0;
    for (const product of products) {
        try {
            await db.execute(
                `INSERT OR IGNORE INTO products (codigo, descripcion, linea_code, linea_name, active)
                 VALUES (?, ?, ?, ?, 1)`,
                [product.codigo, product.descripcion, product.lineaCode, product.lineaName]
            );
            productsInserted++;
        } catch (err) {
            logger.warn('ProductRepository', `Failed to insert product: ${product.codigo}`, { error: String(err) });
        }
    }

    logger.info('ProductRepository', 'Seed complete', { productsInserted, linesInserted });
    return { productsInserted, linesInserted };
}
