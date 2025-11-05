#!/usr/bin/env node

/**
 * Pre-commit hook to check if binary versions are in sync with package.json
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function getPackageVersion() {
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    return packageJson.version;
  } catch (error) {
    console.error('❌ Could not read package.json');
    process.exit(1);
  }
}

function getBinaryVersion(binaryPath) {
  try {
    const output = execSync(`${binaryPath} --version`, { encoding: 'utf8' });
    const match = output.match(/(\d+\.\d+\.\d+)/);
    return match ? match[1] : null;
  } catch (error) {
    return null;
  }
}

function main() {
  const packageVersion = getPackageVersion();
  console.log(`🔍 Checking binary versions against package.json version: ${packageVersion}`);

  const binaries = [
    'bin/ck-darwin-arm64',
    'bin/ck-darwin-x64',
    'bin/ck-linux-x64',
    'bin/ck-win32-x64.exe'
  ];

  let allSynced = true;
  let errors = [];

  for (const binary of binaries) {
    if (fs.existsSync(binary)) {
      const binaryVersion = getBinaryVersion(binary);
      if (binaryVersion === null) {
        console.log(`⚠️  Could not get version from ${binary}`);
        continue;
      }

      if (binaryVersion !== packageVersion) {
        allSynced = false;
        errors.push(`${binary}: ${binaryVersion} (expected ${packageVersion})`);
        console.log(`❌ ${binary} version mismatch: ${binaryVersion} != ${packageVersion}`);
      } else {
        console.log(`✅ ${binary}: ${binaryVersion}`);
      }
    } else {
      console.log(`⚠️  Binary not found: ${binary}`);
    }
  }

  if (!allSynced) {
    console.log('\n❌ Version synchronization issues detected:');
    errors.forEach(error => console.log(`   - ${error}`));
    console.log('\n💡 To fix this, run:');
    console.log('   npm run compile:binary');
    console.log('   bun build src/index.ts --compile --outfile bin/ck-darwin-arm64');
    console.log('   bun build src/index.ts --compile --outfile bin/ck-darwin-x64');
    console.log('   bun build src/index.ts --compile --outfile bin/ck-linux-x64');
    console.log('   bun build src/index.ts --compile --outfile bin/ck-win32-x64.exe');
    process.exit(1);
  }

  console.log('✅ All binary versions are in sync with package.json');
}

main();