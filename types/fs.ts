// --- FILE SYSTEM TYPES ---
export interface FSItem {
  name: string;
  kind: 'file' | 'directory';
  // Note: `any` is intentional here for cross-platform interop (Web FileSystemHandle vs Tauri path)
  handle: any;
  // Legacy Tauri fields — kept for backward compat, not populated in web mode
  isDirectory?: boolean;
  isFile?: boolean;
  path?: string;
}

// =============================================================================
// H-06 Fix: Unified File Handle Types (Web FileSystem API vs Tauri Paths)
// =============================================================================

/**
 * Union type for file handles:
 * - Web mode: FileSystemFileHandle (browser API)
 * - Tauri mode: string (file path)
 */
export type FSFileHandle = FileSystemFileHandle | string;

/**
 * Union type for directory handles:
 * - Web mode: FileSystemDirectoryHandle (browser API)
 * - Tauri mode: string (directory path)
 */
export type FSDirectoryHandle = FileSystemDirectoryHandle | string;
