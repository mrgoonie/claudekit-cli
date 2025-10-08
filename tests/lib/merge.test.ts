import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { FileMerger } from '../../src/lib/merge.js';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('FileMerger', () => {
  let merger: FileMerger;
  let testSourceDir: string;
  let testDestDir: string;

  beforeEach(async () => {
    merger = new FileMerger();

    // Create temporary test directories
    const timestamp = Date.now();
    testSourceDir = join(tmpdir(), `test-source-${timestamp}`);
    testDestDir = join(tmpdir(), `test-dest-${timestamp}`);

    await mkdir(testSourceDir, { recursive: true });
    await mkdir(testDestDir, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup test directories
    if (existsSync(testSourceDir)) {
      await rm(testSourceDir, { recursive: true, force: true });
    }
    if (existsSync(testDestDir)) {
      await rm(testDestDir, { recursive: true, force: true });
    }
  });

  describe('constructor', () => {
    test('should create FileMerger instance', () => {
      expect(merger).toBeInstanceOf(FileMerger);
    });
  });

  describe('addIgnorePatterns', () => {
    test('should add custom ignore patterns', () => {
      const patterns = ['*.log', 'temp/**'];
      expect(() => merger.addIgnorePatterns(patterns)).not.toThrow();
    });

    test('should accept empty array', () => {
      expect(() => merger.addIgnorePatterns([])).not.toThrow();
    });
  });

  describe('merge with skipConfirmation', () => {
    test('should copy files from source to destination', async () => {
      // Create test files
      await writeFile(join(testSourceDir, 'test.txt'), 'test content');
      await writeFile(join(testSourceDir, 'readme.md'), '# README');

      await merger.merge(testSourceDir, testDestDir, true);

      // Verify files were copied
      expect(existsSync(join(testDestDir, 'test.txt'))).toBe(true);
      expect(existsSync(join(testDestDir, 'readme.md'))).toBe(true);
    });

    test('should skip protected files like .env', async () => {
      // Create test files including protected ones
      await writeFile(join(testSourceDir, 'normal.txt'), 'normal');
      await writeFile(join(testSourceDir, '.env'), 'SECRET=value');

      await merger.merge(testSourceDir, testDestDir, true);

      // Verify normal file was copied but .env was not
      expect(existsSync(join(testDestDir, 'normal.txt'))).toBe(true);
      expect(existsSync(join(testDestDir, '.env'))).toBe(false);
    });

    test('should skip protected patterns like *.key', async () => {
      await writeFile(join(testSourceDir, 'normal.txt'), 'normal');
      await writeFile(join(testSourceDir, 'private.key'), 'key data');

      await merger.merge(testSourceDir, testDestDir, true);

      expect(existsSync(join(testDestDir, 'normal.txt'))).toBe(true);
      expect(existsSync(join(testDestDir, 'private.key'))).toBe(false);
    });

    test('should handle nested directories', async () => {
      const nestedDir = join(testSourceDir, 'nested', 'deep');
      await mkdir(nestedDir, { recursive: true });
      await writeFile(join(nestedDir, 'file.txt'), 'nested content');

      await merger.merge(testSourceDir, testDestDir, true);

      expect(existsSync(join(testDestDir, 'nested', 'deep', 'file.txt'))).toBe(true);
    });

    test('should overwrite existing files', async () => {
      // Create files in both directories
      await writeFile(join(testSourceDir, 'file.txt'), 'new content');
      await writeFile(join(testDestDir, 'file.txt'), 'old content');

      await merger.merge(testSourceDir, testDestDir, true);

      const content = await Bun.file(join(testDestDir, 'file.txt')).text();
      expect(content).toBe('new content');
    });

    test('should handle empty source directory', async () => {
      // Empty directory should complete without errors
      await merger.merge(testSourceDir, testDestDir, true);
      // If we get here, the test passed
      expect(true).toBe(true);
    });
  });

  describe('edge cases', () => {
    test('should handle files with special characters in names', async () => {
      const specialFileName = 'file with spaces.txt';
      await writeFile(join(testSourceDir, specialFileName), 'content');

      await merger.merge(testSourceDir, testDestDir, true);

      expect(existsSync(join(testDestDir, specialFileName))).toBe(true);
    });

    test('should skip custom ignore patterns', async () => {
      merger.addIgnorePatterns(['custom-*']);

      await writeFile(join(testSourceDir, 'normal.txt'), 'normal');
      await writeFile(join(testSourceDir, 'custom-ignore.txt'), 'ignore me');

      await merger.merge(testSourceDir, testDestDir, true);

      expect(existsSync(join(testDestDir, 'normal.txt'))).toBe(true);
      expect(existsSync(join(testDestDir, 'custom-ignore.txt'))).toBe(false);
    });
  });
});
