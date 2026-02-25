/**
 * Type declarations for @tauri-apps/plugin-shell
 * 
 * This module is optional and may not be installed.
 * Adding type declaration to prevent TypeScript errors on dynamic imports.
 */
declare module '@tauri-apps/plugin-shell' {
    export function open(path: string, openWith?: string): Promise<void>;
}
