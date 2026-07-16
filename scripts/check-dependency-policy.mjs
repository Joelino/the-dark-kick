import { readFile, readdir } from 'node:fs/promises';
import { extname } from 'node:path';

const approved = {
  dependencies: {
    phaser: '3.90.0',
  },
  devDependencies: {
    typescript: '5.9.3',
    vite: '7.3.5',
    vitest: '3.2.6',
  },
};
const approvedOverrides = {
  esbuild: '0.27.2',
};
const approvedInstallScripts = {
  'esbuild@0.27.2': true,
  'fsevents@2.3.3': true,
};

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const packageLock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));
const errors = [];

for (const group of ['dependencies', 'devDependencies']) {
  const declared = packageJson[group] ?? {};
  const expected = approved[group];

  for (const [name, version] of Object.entries(declared)) {
    if (!(name in expected)) {
      errors.push(`${group}: "${name}" is not on the reviewed direct-dependency allowlist`);
    } else if (version !== expected[name]) {
      errors.push(`${group}: "${name}" must be pinned exactly to ${expected[name]} (found ${version})`);
    }
  }

  for (const [name, version] of Object.entries(expected)) {
    if (declared[name] !== version) {
      errors.push(`${group}: expected reviewed package "${name}@${version}"`);
    }
  }
}

checkExactMap('overrides', packageJson.overrides ?? {}, approvedOverrides);
checkExactMap('allowScripts', packageJson.allowScripts ?? {}, approvedInstallScripts);

for (const [packagePath, lockedPackage] of Object.entries(packageLock.packages ?? {})) {
  if (!packagePath) continue;

  if (lockedPackage.resolved && !lockedPackage.resolved.startsWith('https://registry.npmjs.org/')) {
    errors.push(`package-lock.json: "${packagePath}" resolves outside the npm registry`);
  }

  if (lockedPackage.hasInstallScript) {
    const packageName = packagePath.split('node_modules/').at(-1);
    const approval = `${packageName}@${lockedPackage.version}`;
    if (approvedInstallScripts[approval] !== true) {
      errors.push(`package-lock.json: install script for "${approval}" is not approved`);
    }
  }
}

const sourceRoot = new URL('../src/', import.meta.url);
const sourceFiles = await collectTypeScriptFiles(sourceRoot);
const allowedImports = new Set([
  ...Object.keys(approved.dependencies),
  ...Object.keys(approved.devDependencies),
]);
const importPattern = /\bfrom\s+['"]([^'"]+)['"]|\bimport\s+['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

for (const file of sourceFiles) {
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1] ?? match[2] ?? match[3];
    if (specifier.startsWith('.') || specifier.startsWith('/')) continue;

    const packageName = specifier.startsWith('@')
      ? specifier.split('/').slice(0, 2).join('/')
      : specifier.split('/')[0];
    if (!allowedImports.has(packageName)) {
      errors.push(`${file.pathname}: bare import "${specifier}" is not from an approved direct dependency`);
    }
  }
}

if (errors.length > 0) {
  console.error('Dependency policy failed:\n');
  for (const error of errors) console.error(`- ${error}`);
  console.error('\nReview popularity, ownership, release age, and install scripts before changing the allowlist.');
  process.exit(1);
}

console.log('Dependency policy passed: direct packages and imports match the reviewed allowlist.');

function checkExactMap(label, actual, expected) {
  for (const [name, value] of Object.entries(actual)) {
    if (!(name in expected)) {
      errors.push(`${label}: "${name}" is not approved`);
    } else if (value !== expected[name]) {
      errors.push(`${label}: "${name}" must be ${expected[name]} (found ${value})`);
    }
  }

  for (const [name, value] of Object.entries(expected)) {
    if (actual[name] !== value) {
      errors.push(`${label}: expected "${name}" to be ${value}`);
    }
  }
}

async function collectTypeScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
    if (entry.isDirectory()) {
      files.push(...await collectTypeScriptFiles(path));
    } else if (['.ts', '.tsx'].includes(extname(entry.name))) {
      files.push(path);
    }
  }

  return files;
}
