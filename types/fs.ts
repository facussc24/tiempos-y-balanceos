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

/**
 * Type guard: Check if handle is a Tauri path (string)
 */
function isTauriPath(handle: FSFileHandle | FSDirectoryHandle | null | undefined): handle is string {
  return typeof handle === 'string';
}

/**
 * Type guard: Check if handle is a Web FileSystemFileHandle
 */
function isWebFileHandle(handle: FSFileHandle | null | undefined): handle is FileSystemFileHandle {
  return handle !== null && handle !== undefined && typeof handle !== 'string' && 'getFile' in handle;
}

/**
 * Type guard: Check if handle is a Web FileSystemDirectoryHandle
 */
function isWebDirectoryHandle(handle: FSDirectoryHandle | null | undefined): handle is FileSystemDirectoryHandle {
  return handle !== null && handle !== undefined && typeof handle !== 'string' && 'getDirectoryHandle' in handle;
}
