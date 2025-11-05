#!/usr/bin/env node

/**
 * Semantic Release Plugin
 * Rebuilds binaries after package.json version is bumped
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

async function rebuildBinaries(pluginConfig, context) {
  const { logger, nextRelease } = context;
  const { version } = nextRelease;

  logger.log(`Rebuilding binaries with version ${version}...`);

  try {
    // Ensure bin directory exists
    if (!fs.existsSync('bin')) {
      fs.mkdirSync('bin', { recursive: true });
    }

    // Build binary for current platform
    logger.log('Building current platform binary...');
    execSync('bun build src/index.ts --compile --outfile bin/ck-linux-x64', { stdio: 'inherit' });
    execSync('chmod +x bin/ck-linux-x64', { stdio: 'inherit' });

    // Cross-compile for other platforms
    const platforms = [
      { target: 'darwin-arm64', output: 'bin/ck-darwin-arm64' },
      { target: 'darwin-x64', output: 'bin/ck-darwin-x64' },
      { target: 'win32-x64', output: 'bin/ck-win32-x64.exe' },
    ];

    for (const platform of platforms) {
      logger.log(`Building for ${platform.target}...`);
      try {
        execSync(`bun build src/index.ts --compile --target bun-${platform.target} --outfile ${platform.output}`, { stdio: 'inherit' });
        if (!platform.output.endsWith('.exe')) {
          execSync(`chmod +x ${platform.output}`, { stdio: 'inherit' });
        }
      } catch (error) {
        logger.warn(`Failed to build for ${platform.target}: ${error.message}`);
      }
    }

    // Verify the main binary shows correct version
    logger.log('Verifying binary version...');
    try {
      const output = execSync('./bin/ck-linux-x64 --version', { encoding: 'utf8' });
      if (output.includes(version)) {
        logger.log(`✅ Binary version verification passed: ${version}`);
      } else {
        logger.warn(`⚠️ Binary version mismatch. Expected: ${version}, Got: ${output.trim()}`);
      }
    } catch (error) {
      logger.warn(`Could not verify binary version: ${error.message}`);
    }

    logger.log('✅ Binary rebuild completed successfully');

  } catch (error) {
    logger.error(`❌ Failed to rebuild binaries: ${error.message}`);
    throw error;
  }
}

module.exports = { rebuildBinaries };