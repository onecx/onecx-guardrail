const fs = require('node:fs');
const path = require('node:path');

const source = path.join(__dirname, '..', '..', '..', 'shared', 'default-config.json');
const target = path.join(__dirname, '..', 'dist', 'default-config.json');
if (fs.existsSync(source)) {
  fs.copyFileSync(source, target);
} else if (!fs.existsSync(target)) {
  throw new Error('shared/default-config.json not found; build from the monorepo checkout');
}
