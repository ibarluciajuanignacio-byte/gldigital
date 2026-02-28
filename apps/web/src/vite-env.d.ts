/// <reference types="vite/client" />

declare module "isotope-layout" {
  interface IsotopeOptions {
    itemSelector?: string;
    layoutMode?: string;
    [key: string]: unknown;
  }
  export default class Isotope {
    constructor(element: Element, options: IsotopeOptions);
    arrange(options: { filter?: string }): void;
    reloadItems(): void;
    layout(): void;
    destroy(): void;
  }
}

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
