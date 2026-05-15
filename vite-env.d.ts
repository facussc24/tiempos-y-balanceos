/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly DEV: boolean;
    readonly PROD: boolean;
    readonly MODE: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

// Globales inyectados por vite.config define
declare const __APP_VERSION__: string;
declare const __BUILD_TIMESTAMP__: number;
