/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly DEV: boolean;
    readonly PROD: boolean;
    readonly MODE: string;
    readonly GEMINI_API_KEY?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
