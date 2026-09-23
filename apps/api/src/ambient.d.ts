/* Ambient declarations for Node.js built-ins, third-party packages, and runtime globals */

declare module 'node:*' {
  const all: any;
  export default all;
  export const spawn: any;
  export type ChildProcess = any;
  export const ChildProcess: any;
  export const mkdir: any;
  export const mkdtemp: any;
  export const writeFile: any;
  export const readFile: any;
  export const readdir: any;
  export const copyFile: any;
  export const rm: any;
  export const stat: any;
  export const lstat: any;
  export const opendir: any;
  export const open: any;
  export const realpath: any;
  export const rename: any;
  export const unlink: any;
  export const existsSync: any;
  export const readdirSync: any;
  export const unlinkSync: any;
  export const statSync: any;
  export const createHash: any;
  export const randomUUID: any;
  export const randomBytes: any;
  export const fileURLToPath: any;
  export const tmpdir: any;
  export const setTimeout: any;
}

declare module 'yaml' {
  export const parse: (text: string, ...args: any[]) => any;
  export const parseAllDocuments: (text: string, ...args: any[]) => any[];
  export const stringify: (value: any, ...args: any[]) => string;
}

declare module 'playwright' {
  export const chromium: any;
  export const firefox: any;
  export const webkit: any;
  export type Browser = any;
  export type BrowserContext = any;
  export type CDPSession = any;
  export type Page = any;
}

declare namespace NodeJS {
  interface ProcessEnv {
    [key: string]: string | undefined;
  }
  interface ErrnoException extends Error {
    errno?: number;
    code?: string;
    path?: string;
    syscall?: string;
  }
  interface Process {
    env: ProcessEnv;
    platform: string;
    pid: number;
    kill(pid: number, signal?: string | number): boolean;
    argv: string[];
    exitCode?: number;
    cwd(): string;
  }
  type Timeout = any;
}

declare var process: NodeJS.Process;

interface Buffer {
  toString(encoding?: string): string;
  slice(start?: number, end?: number): Buffer;
  subarray(start?: number, end?: number): Buffer;
  length: number;
  [index: number]: number;
}

declare var Buffer: {
  from(value: any, encoding?: string): Buffer;
  alloc(size: number): Buffer;
  concat(list: any[]): Buffer;
  byteLength(string: any, encoding?: string): number;
  isBuffer(obj: any): obj is Buffer;
};

declare function setImmediate(callback: (...args: any[]) => void, ...args: any[]): any;
declare function clearImmediate(immediateId: any): void;
