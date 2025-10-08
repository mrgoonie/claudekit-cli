import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { DownloadManager } from '../../src/lib/download.js';
import { DownloadError, ExtractionError } from '../../src/types.js';
import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';

describe('DownloadManager', () => {
  let manager: DownloadManager;

  beforeEach(() => {
    manager = new DownloadManager();
  });

  describe('constructor', () => {
    test('should create DownloadManager instance', () => {
      expect(manager).toBeInstanceOf(DownloadManager);
    });
  });

  describe('createTempDir', () => {
    test('should create temporary directory', async () => {
      const tempDir = await manager.createTempDir();

      expect(tempDir).toBeDefined();
      expect(typeof tempDir).toBe('string');
      expect(tempDir).toContain('claudekit-');
      expect(existsSync(tempDir)).toBe(true);

      // Cleanup
      await rm(tempDir, { recursive: true, force: true });
    });

    test('should create unique directories', async () => {
      const tempDir1 = await manager.createTempDir();

      // Wait 1ms to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1));

      const tempDir2 = await manager.createTempDir();

      expect(tempDir1).not.toBe(tempDir2);

      // Cleanup
      await rm(tempDir1, { recursive: true, force: true });
      await rm(tempDir2, { recursive: true, force: true });
    });
  });

  describe('error classes', () => {
    test('DownloadError should store message', () => {
      const error = new DownloadError('Download failed');
      expect(error.message).toBe('Download failed');
      expect(error.code).toBe('DOWNLOAD_ERROR');
      expect(error.name).toBe('DownloadError');
    });

    test('ExtractionError should store message', () => {
      const error = new ExtractionError('Extraction failed');
      expect(error.message).toBe('Extraction failed');
      expect(error.code).toBe('EXTRACTION_ERROR');
      expect(error.name).toBe('ExtractionError');
    });
  });

  // Note: Testing actual download and extraction would require:
  // 1. Mock GitHub API responses
  // 2. Test fixture archives
  // 3. Network mocking
  // These are integration tests that would be better suited for e2e testing
});
