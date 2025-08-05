/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_GENAI_API_KEY: string
  readonly VITE_OPENAI_API_KEY: string
  readonly VITE_OPENAI_BASE_URL: string
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module 'marked';
declare module 'dompurify';