/**
 * Current User
 *
 * Module-level store for the authenticated user's email.
 * Set by AuthProvider on login; read by repositories to populate
 * created_by / updated_by audit columns.
 */

let _email = '';

export function setCurrentUserEmail(email: string): void {
    _email = email;
}

export function getCurrentUserEmail(): string {
    return _email;
}
