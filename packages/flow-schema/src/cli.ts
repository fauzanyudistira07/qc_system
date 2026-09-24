import { readFile } from 'node:fs/promises';
import { validateFlow } from './index.ts';

const file = process.argv[2];
if (!file) throw new Error('Usage: npm run validate:example -- file.yaml');
const result = validateFlow(await readFile(file, 'utf8'));
console.log(JSON.stringify(result, null, 2));
if (!result.valid) process.exitCode = 1;
