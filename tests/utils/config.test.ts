import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { ConfigManager } from '../../src/utils/config.js';
import type { Config } from '../../src/types.js';

const TEST_CONFIG_DIR = join(homedir(), '.claudekit-test');
const TEST_CONFIG_FILE = join(TEST_CONFIG_DIR, 'config.json');

describe('ConfigManager', () => {
  beforeEach(async () => {
    // Create test config directory
    if (!existsSync(TEST_CONFIG_DIR)) {
      await mkdir(TEST_CONFIG_DIR, { recursive: true });
    }

    // Override config paths for testing
    // Note: This is a simplified test - in production we'd need to mock the paths
  });

  afterEach(async () => {
    // Clean up test config directory
    if (existsSync(TEST_CONFIG_DIR)) {
      await rm(TEST_CONFIG_DIR, { recursive: true, force: true });
    }

    // Reset ConfigManager state
    (ConfigManager as any).config = null;
  });

  describe('load', () => {
    test('should return default config when no config file exists', async () => {
      const config = await ConfigManager.load();
      expect(config).toEqual({ github: {}, defaults: {} });
    });

    test('should load config from file when it exists', async () => {
      const testConfig: Config = {
        github: { token: 'test-token' },
        defaults: { kit: 'engineer', dir: './test' },
      };

      // Write test config file (to actual location for this test)
      const actualConfigDir = join(homedir(), '.claudekit');
      const actualConfigFile = join(actualConfigDir, 'config.json');

      if (!existsSync(actualConfigDir)) {
        await mkdir(actualConfigDir, { recursive: true });
      }
      await writeFile(actualConfigFile, JSON.stringify(testConfig));

      try {
        const config = await ConfigManager.load();
        expect(config.github?.token).toBe('test-token');
        expect(config.defaults?.kit).toBe('engineer');
      } finally {
        // Cleanup
        if (existsSync(actualConfigFile)) {
          await rm(actualConfigFile);
        }
      }
    });

    test('should return default config on invalid JSON', async () => {
      const actualConfigDir = join(homedir(), '.claudekit');
      const actualConfigFile = join(actualConfigDir, 'config.json');

      if (!existsSync(actualConfigDir)) {
        await mkdir(actualConfigDir, { recursive: true });
      }
      await writeFile(actualConfigFile, 'invalid json');

      try {
        const config = await ConfigManager.load();
        expect(config).toEqual({ github: {}, defaults: {} });
      } finally {
        // Cleanup
        if (existsSync(actualConfigFile)) {
          await rm(actualConfigFile);
        }
      }
    });

    test('should cache config after first load', async () => {
      const config1 = await ConfigManager.load();
      const config2 = await ConfigManager.load();
      expect(config1).toBe(config2); // Same reference
    });
  });

  describe('save', () => {
    test('should save valid config to file', async () => {
      const testConfig: Config = {
        github: { token: 'test-token' },
        defaults: { kit: 'marketing', dir: './projects' },
      };

      await ConfigManager.save(testConfig);

      // Verify file was created
      const actualConfigFile = join(homedir(), '.claudekit', 'config.json');
      expect(existsSync(actualConfigFile)).toBe(true);

      // Cleanup
      if (existsSync(actualConfigFile)) {
        await rm(actualConfigFile);
      }
      const actualConfigDir = join(homedir(), '.claudekit');
      if (existsSync(actualConfigDir)) {
        await rm(actualConfigDir, { recursive: true });
      }
    });

    test('should create config directory if it does not exist', async () => {
      const actualConfigDir = join(homedir(), '.claudekit');
      if (existsSync(actualConfigDir)) {
        await rm(actualConfigDir, { recursive: true });
      }

      const testConfig: Config = { github: {}, defaults: {} };
      await ConfigManager.save(testConfig);

      expect(existsSync(actualConfigDir)).toBe(true);

      // Cleanup
      if (existsSync(actualConfigDir)) {
        await rm(actualConfigDir, { recursive: true });
      }
    });

    test('should throw error on invalid config', async () => {
      const invalidConfig = {
        github: { token: 123 }, // Invalid: should be string
      };

      await expect(ConfigManager.save(invalidConfig as any)).rejects.toThrow();
    });

    test('should update cached config', async () => {
      const testConfig: Config = {
        github: { token: 'new-token' },
        defaults: {},
      };

      await ConfigManager.save(testConfig);
      const loaded = await ConfigManager.get();
      expect(loaded.github?.token).toBe('new-token');

      // Cleanup
      const actualConfigFile = join(homedir(), '.claudekit', 'config.json');
      const actualConfigDir = join(homedir(), '.claudekit');
      if (existsSync(actualConfigFile)) {
        await rm(actualConfigFile);
      }
      if (existsSync(actualConfigDir)) {
        await rm(actualConfigDir, { recursive: true });
      }
    });
  });

  describe('get', () => {
    test('should return current config', async () => {
      const config = await ConfigManager.get();
      expect(config).toBeDefined();
      expect(config).toHaveProperty('github');
      expect(config).toHaveProperty('defaults');
    });
  });

  describe('set', () => {
    test('should set nested config value', async () => {
      await ConfigManager.set('github.token', 'test-token-123');
      const config = await ConfigManager.get();
      expect(config.github?.token).toBe('test-token-123');

      // Cleanup
      const actualConfigFile = join(homedir(), '.claudekit', 'config.json');
      const actualConfigDir = join(homedir(), '.claudekit');
      if (existsSync(actualConfigFile)) {
        await rm(actualConfigFile);
      }
      if (existsSync(actualConfigDir)) {
        await rm(actualConfigDir, { recursive: true });
      }
    });

    test('should create nested objects if they do not exist', async () => {
      await ConfigManager.set('defaults.kit', 'engineer');
      const config = await ConfigManager.get();
      expect(config.defaults?.kit).toBe('engineer');

      // Cleanup
      const actualConfigFile = join(homedir(), '.claudekit', 'config.json');
      const actualConfigDir = join(homedir(), '.claudekit');
      if (existsSync(actualConfigFile)) {
        await rm(actualConfigFile);
      }
      if (existsSync(actualConfigDir)) {
        await rm(actualConfigDir, { recursive: true });
      }
    });

    test('should handle multiple nested levels', async () => {
      await ConfigManager.set('defaults.dir', '/test/path');
      const config = await ConfigManager.get();
      expect(config.defaults?.dir).toBe('/test/path');

      // Cleanup
      const actualConfigFile = join(homedir(), '.claudekit', 'config.json');
      const actualConfigDir = join(homedir(), '.claudekit');
      if (existsSync(actualConfigFile)) {
        await rm(actualConfigFile);
      }
      if (existsSync(actualConfigDir)) {
        await rm(actualConfigDir, { recursive: true });
      }
    });
  });

  describe('getToken', () => {
    test('should return token from config', async () => {
      await ConfigManager.setToken('test-token-456');
      const token = await ConfigManager.getToken();
      expect(token).toBe('test-token-456');

      // Cleanup
      const actualConfigFile = join(homedir(), '.claudekit', 'config.json');
      const actualConfigDir = join(homedir(), '.claudekit');
      if (existsSync(actualConfigFile)) {
        await rm(actualConfigFile);
      }
      if (existsSync(actualConfigDir)) {
        await rm(actualConfigDir, { recursive: true });
      }
    });

    test('should return undefined if no token is set', async () => {
      (ConfigManager as any).config = null;
      const token = await ConfigManager.getToken();
      expect(token).toBeUndefined();
    });
  });

  describe('setToken', () => {
    test('should set token in config', async () => {
      await ConfigManager.setToken('new-test-token');
      const config = await ConfigManager.get();
      expect(config.github?.token).toBe('new-test-token');

      // Cleanup
      const actualConfigFile = join(homedir(), '.claudekit', 'config.json');
      const actualConfigDir = join(homedir(), '.claudekit');
      if (existsSync(actualConfigFile)) {
        await rm(actualConfigFile);
      }
      if (existsSync(actualConfigDir)) {
        await rm(actualConfigDir, { recursive: true });
      }
    });
  });
});
