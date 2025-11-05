#!/usr/bin/env node

/**
 * Build all platform binaries with current package.json version
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

function main() {
  const version = getPackageVersion();
  console.log(`🔨 Building all binaries for version ${version}...`);

  // Ensure bin directory exists
  if (!fs.existsSync('bin')) {
    fs.mkdirSync('bin', { recursive: true });
  }

  const platforms = [
    {
      name: 'darwin-arm64',
      target: 'bun-darwin-arm64',
      output: 'bin/ck-darwin-arm64',
      ext: ''
    },
    {
      name: 'darwin-x64',
      target: 'bun-darwin-x64',
      output: 'bin/ck-darwin-x64',
      ext: ''
    },
    {
      name: 'linux-x64',
      target: 'bun-linux-x64',
      output: 'bin/ck-linux-x64',
      ext: ''
    },
    {
      name: 'win32-x64',
      target: 'bun-win32-x64',
      output: 'bin/ck-win32-x64.exe',
      ext: '.exe'
    }
  ];

  for (const platform of platforms) {
    console.log(`\n📦 Building ${platform.name}...`);
    try {
      execSync(`bun build src/index.ts --compile --target ${platform.target} --outfile ${platform.output}`, { stdio: 'inherit' });

      if (!platform.ext) {
        execSync(`chmod +x ${platform.output}`, { stdio: 'inherit' });
      }

      // Verify the binary
      const output = execSync(`${platform.output} --version`, { encoding: 'utf8' });
      if (output.includes(version)) {
        console.log(`✅ ${platform.name}: ${output.trim()}`);
      } else {
        console.log(`⚠️  ${platform.name}: Version mismatch. Expected: ${version}, Got: ${output.trim()}`);
      }
    } catch (error) {
      console.log(`❌ Failed to build ${platform.name}: ${error.message}`);
    }
  }

  console.log('\n✅ Binary compilation completed');
  console.log('\n📁 Generated binaries:');
  execSync('ls -lh bin/', { stdio: 'inherit' });
}

main();