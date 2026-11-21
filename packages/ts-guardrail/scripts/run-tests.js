const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const dir = path.join(__dirname, '..', 'dist', 'test');
const files = fs.readdirSync(dir).filter((name) => name.endsWith('.test.js')).map((name) => path.join(dir, name));
const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(result.status ?? 1);
