export type AndroidDevice = {
  serial: string;
  type: 'emulator' | 'physical';
  status: 'device' | 'offline' | 'unauthorized';
  model?: string;
};

export type AvdInfo = {
  name: string;
  device?: string;
  path?: string;
  target?: string;
};

export type EmulatorOptions = {
  noWindow?: boolean;
  noAudio?: boolean;
  noBootAnim?: boolean;
  gpu?: string;
  memoryMb?: number;
  cores?: number;
  timeoutMs?: number;
};

export type AndroidStatus = {
  maestro: { available: boolean; message: string; version?: string };
  adb: { available: boolean; message: string; devices: string[] };
  emulator?: { available: boolean; message: string; avds: string[] };
};

export type InstallApkResult = {
  success: boolean;
  output: string;
  device: string;
  usedExisting?: boolean;
};

export type ApkMetadata = {
  packageId?: string;
  appName?: string;
  versionName?: string;
  launchableActivity?: string;
};
