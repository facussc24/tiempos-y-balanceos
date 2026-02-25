# Persistence Layer Architecture

> H-08: Dependency documentation for the File I/O & Concurrency system.

## Module Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────┐
│                          UI LAYER                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   App.tsx ──────────────────────────────────────────────────────┐   │
│       │                                                         │   │
│       ├── useProjectPersistence.ts (Hook)                       │   │
│       │       │                                                 │   │
│       │       ├── db.ts (IndexedDB auto-save)                   │   │
│       │       │                                                 │   │
│       │       └──┬── fs_helpers.ts (Web FSA API)                │   │
│       │          │                                              │   │
│       │          └── tauri_smart_save.ts (Desktop Path API)     │   │
│       │                       │                                 │   │
│       │                       ▼                                 │   │
│       │               concurrency.ts (Shared)                   │   │
│       │                       │                                 │   │
│       │                       ├── Lock Management               │   │
│       │                       ├── Atomic Write                  │   │
│       │                       └── Checksum / Conflict           │   │
│       │                                                         │   │
│       └── useSessionLock.ts (Hook)                              │   │
│               │                                                 │   │
│               └── sessionLock.ts (BroadcastChannel)             │   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

Legend:
  ─── Static Import
  ──▶ Dynamic Import (code splitting)
```

## Key Modules

| Module | Purpose | Mode |
|--------|---------|------|
| `useProjectPersistence.ts` | Auto-save, manual save, conflict UI | Both |
| `useSessionLock.ts` | Cross-tab lock coordination | Both |
| `db.ts` | IndexedDB CRUD + encryption | Both |
| `fs_helpers.ts` | File System Access API operations | Web |
| `tauri_smart_save.ts` | Rust IPC file operations | Tauri |
| `concurrency.ts` | Lock files, checksums, atomic writes | Both |
| `sessionLock.ts` | BroadcastChannel for tab sync | Both |

## Mode Detection

```typescript
// utils/unified_fs.ts
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}
```

## Important Types

```typescript
// types.ts (H-06 additions)
export type FSFileHandle = FileSystemFileHandle | string;
export type FSDirectoryHandle = FileSystemDirectoryHandle | string;

// Type guards
export function isTauriPath(handle): handle is string;
export function isWebFileHandle(handle): handle is FileSystemFileHandle;
export function isWebDirectoryHandle(handle): handle is FileSystemDirectoryHandle;
```

## Data Flow

1. **Load**: `App.tsx` → `useProjectPersistence` → `db.ts` (latest from IndexedDB)
2. **Auto-save**: Every 2s debounced → `db.ts` (blocked during manual save)
3. **Manual Save**: User click → Mode detection → `fs_helpers.ts` OR `tauri_smart_save.ts`
4. **Lock Flow**: `acquireLock()` → write → `releaseLock()` (with heartbeat)

## Error Handling

Both `fs_helpers.ts` and `tauri_smart_save.ts` now use:
- `logger.error()` / `logger.warn()` for structured logging
- Error classification (transient vs permanent)
- `ConflictError` for version conflicts
