/**
 * Estado de salud de las lecturas a la base de datos.
 *
 * Existe por una regla que salio del incidente de los backups vacios de julio
 * 2026: **una lista vacia nunca puede significar "no pude leer"**. Hasta el
 * 2026-08-08, si una lectura a Supabase fallaba, SupabaseAdapter.select()
 * devolvia `[]` y la app mostraba "no hay documentos" como si nada. Ahora
 * select() lanza el error Y lo reporta aca, y DbHealthBanner lo muestra
 * en cualquier modulo.
 *
 * Store minimo sin dependencias (compatible con useSyncExternalStore).
 */

export interface DbHealthState {
    /** Mensaje del ultimo error de lectura, o null si la ultima lectura anduvo. */
    lastReadError: string | null;
    /** Momento (Date.now()) del ultimo error, para distinguir errores nuevos. */
    at: number | null;
}

let state: DbHealthState = { lastReadError: null, at: null };
const listeners = new Set<() => void>();

function notify(): void {
    for (const cb of listeners) cb();
}

export function reportDbReadError(message: string): void {
    state = { lastReadError: message, at: Date.now() };
    notify();
}

/** Una lectura exitosa limpia el error (la base volvio a responder). */
export function clearDbReadError(): void {
    if (state.lastReadError === null) return;
    state = { lastReadError: null, at: null };
    notify();
}

export function getDbHealth(): DbHealthState {
    return state;
}

export function subscribeDbHealth(callback: () => void): () => void {
    listeners.add(callback);
    return () => listeners.delete(callback);
}
