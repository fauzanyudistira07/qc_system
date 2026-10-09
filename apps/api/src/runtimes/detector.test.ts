import test from 'node:test';
import assert from 'node:assert';
import { detectProjectRuntime } from './detector.ts';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdir, writeFile, rm } from 'node:fs/promises';

test('detectProjectRuntime resolves Laravel 8 correctly', async () => {
  const temp = path.join(tmpdir(), `test-laravel-8-${Date.now()}`);
  await mkdir(temp, { recursive: true });
  await writeFile(
    path.join(temp, 'composer.json'),
    JSON.stringify({
      require: {
        'php': '^7.4 || ^8.0',
        'laravel/framework': '^8.40'
      }
    })
  );

  const res = await detectProjectRuntime(temp);
  assert.strictEqual(res.ecosystem, 'laravel');
  assert.strictEqual(res.runtimeVersion, '8.0');
  assert.strictEqual(res.recommendedImage, 'qc-runtime:php-8.0');

  await rm(temp, { recursive: true, force: true });
});

test('detectProjectRuntime resolves Laravel 10 correctly', async () => {
  const temp = path.join(tmpdir(), `test-laravel-10-${Date.now()}`);
  await mkdir(temp, { recursive: true });
  await writeFile(
    path.join(temp, 'composer.json'),
    JSON.stringify({
      require: {
        'php': '^8.1',
        'laravel/framework': '^10.0'
      }
    })
  );

  const res = await detectProjectRuntime(temp);
  assert.strictEqual(res.ecosystem, 'laravel');
  assert.strictEqual(res.runtimeVersion, '8.2');
  assert.strictEqual(res.recommendedImage, 'qc-runtime:php-8.2');

  await rm(temp, { recursive: true, force: true });
});

test('detectProjectRuntime resolves Node with Next.js', async () => {
  const temp = path.join(tmpdir(), `test-node-${Date.now()}`);
  await mkdir(temp, { recursive: true });
  await writeFile(
    path.join(temp, 'package.json'),
    JSON.stringify({
      name: 'my-next-app',
      engines: { node: '>=20' },
      dependencies: { next: '^14.0' }
    })
  );

  const res = await detectProjectRuntime(temp);
  assert.strictEqual(res.ecosystem, 'node');
  assert.strictEqual(res.frameworkName, 'Next.js');
  assert.strictEqual(res.runtimeVersion, '20');
  assert.strictEqual(res.recommendedImage, 'node:20-alpine');

  await rm(temp, { recursive: true, force: true });
});
