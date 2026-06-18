/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_SIGNALING_URL: string;

  readonly VITE_TURN_USERNAME: string;
  readonly VITE_TURN_CREDENTIAL: string;

  readonly VITE_TURN_UDP_URL: string;
  readonly VITE_TURN_TCP_URL: string;
  readonly VITE_TURNS_TCP_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}