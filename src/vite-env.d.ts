/// <reference types="vite/client" />

declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*?raw' {
  const source: string;
  export default source;
}

declare namespace JSX {
  interface IntrinsicElements {
    'hyperframes-player': {
        src?: string;
        srcdoc?: string;
        srcDoc?: string;
        width?: number;
        height?: number;
        controls?: boolean;
        muted?: boolean;
        volume?: number;
        style?: Record<string, string | number>;
        ref?: unknown;
      };
  }
}
