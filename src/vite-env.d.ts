/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_ADVANCED_ADMIN?: string;
  readonly VITE_ENABLE_ADVANCED_CALLS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
