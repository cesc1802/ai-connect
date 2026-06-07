/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEV_JWT?: string;
  readonly VITE_WS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
