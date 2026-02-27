/// <reference types="vite/client" />

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "lord-icon": {
        src?: string;
        trigger?: string;
        colors?: string;
        class?: string;
        style?: Record<string, string | number>;
      };
    }
  }
}

export {};
