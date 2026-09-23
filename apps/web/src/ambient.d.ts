/* Ambient definitions for React and JSX in web frontend */

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
  type Element = any;
}

declare namespace React {
  export type ReactNode = any;
  export type CSSProperties = any;
  export type FC<P = {}> = (props: P) => any;
  export type ChangeEvent<T = any> = any;
  export type FormEvent<T = any> = any;
  export type MouseEvent<T = any> = any;
}

declare module 'react' {
  const React: any;
  export default React;
  export const useState: <T>(initial?: T | (() => T)) => [T, (val: T | ((prev: T) => T)) => void];
  export const useEffect: (effect: () => void | (() => void), deps?: any[]) => void;
  export const useMemo: <T>(factory: () => T, deps?: any[]) => T;
  export const useCallback: <T extends (...args: any[]) => any>(callback: T, deps?: any[]) => T;
  export const useRef: <T>(initialValue?: T) => { current: T };
  export const createContext: <T>(defaultValue?: T) => any;
  export const useContext: <T>(context: any) => T;
  export type ReactNode = any;
  export type CSSProperties = any;
  export type FC<P = {}> = (props: P) => any;
  export type ChangeEvent<T = any> = any;
  export type FormEvent<T = any> = any;
  export type MouseEvent<T = any> = any;
}

declare module 'react-dom/client' {
  export function createRoot(container: any): {
    render(children: any): void;
    unmount(): void;
  };
}

declare module 'react/jsx-runtime' {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}
