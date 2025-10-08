import { describe, expect, test, beforeEach } from 'bun:test';
import { PromptsManager } from '../../src/lib/prompts.js';
import { AVAILABLE_KITS } from '../../src/types.js';

describe('PromptsManager', () => {
  let manager: PromptsManager;

  beforeEach(() => {
    manager = new PromptsManager();
  });

  describe('constructor', () => {
    test('should create PromptsManager instance', () => {
      expect(manager).toBeInstanceOf(PromptsManager);
    });
  });

  describe('utility methods', () => {
    test('intro should not throw', () => {
      expect(() => manager.intro('Test intro')).not.toThrow();
    });

    test('outro should not throw', () => {
      expect(() => manager.outro('Test outro')).not.toThrow();
    });

    test('note should not throw', () => {
      expect(() => manager.note('Test note', 'Title')).not.toThrow();
    });

    test('note should work without title', () => {
      expect(() => manager.note('Test note')).not.toThrow();
    });
  });

  // Note: Interactive prompt tests (selectKit, selectVersion, getDirectory, confirm)
  // would require mocking the @clack/prompts library or using integration tests
  // with simulated user input. These are better suited for e2e testing.

  describe('validation logic', () => {
    test('selectVersion should handle empty versions array', async () => {
      await expect(manager.selectVersion([], undefined)).rejects.toThrow('No versions available');
    });

    test('selectVersion should return first version when only one exists', async () => {
      const versions = ['v1.0.0'];
      const result = await manager.selectVersion(versions);
      expect(result).toBe('v1.0.0');
    });

    test('selectVersion should return first version when no default is provided', async () => {
      const versions = ['v1.0.0', 'v2.0.0'];
      const result = await manager.selectVersion(versions);
      expect(result).toBe('v1.0.0');
    });
  });

  describe('kit configuration', () => {
    test('AVAILABLE_KITS should be properly structured', () => {
      expect(AVAILABLE_KITS.engineer).toBeDefined();
      expect(AVAILABLE_KITS.marketing).toBeDefined();
      expect(AVAILABLE_KITS.engineer.name).toBe('ClaudeKit Engineer');
      expect(AVAILABLE_KITS.marketing.name).toBe('ClaudeKit Marketing');
    });
  });
});
