import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test';
import { logger } from '../../src/utils/logger.js';

describe('Logger Utilities', () => {
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  const originalDebug = process.env.DEBUG;

  beforeEach(() => {
    consoleLogSpy = mock(() => {});
    consoleErrorSpy = mock(() => {});
    console.log = consoleLogSpy;
    console.error = consoleErrorSpy;
  });

  afterEach(() => {
    process.env.DEBUG = originalDebug;
    consoleLogSpy.mockRestore?.();
    consoleErrorSpy.mockRestore?.();
  });

  describe('info', () => {
    test('should log info messages', () => {
      logger.info('Test info message');
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('success', () => {
    test('should log success messages', () => {
      logger.success('Test success message');
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('warning', () => {
    test('should log warning messages', () => {
      logger.warning('Test warning message');
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('error', () => {
    test('should log error messages', () => {
      logger.error('Test error message');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('debug', () => {
    test('should log debug messages when DEBUG is set', () => {
      process.env.DEBUG = 'true';
      logger.debug('Test debug message');
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    test('should not log debug messages when DEBUG is not set', () => {
      delete process.env.DEBUG;
      logger.debug('Test debug message');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('sanitize', () => {
    test('should sanitize ghp_ tokens (36 chars)', () => {
      const text = 'Token: ghp_123456789012345678901234567890123456';
      const sanitized = logger.sanitize(text);
      expect(sanitized).toBe('Token: ghp_***');
    });

    test('should sanitize github_pat_ tokens (82 chars)', () => {
      // github_pat_ prefix + 82 alphanumeric/underscore characters (exact length)
      const token = '1234567890123456789012345678901234567890123456789012345678901234567890123456789012';
      const text = `Token: github_pat_${token}`;
      const sanitized = logger.sanitize(text);
      expect(sanitized).toBe('Token: github_pat_***');
    });

    test('should sanitize gho_ tokens (36 chars)', () => {
      const text = 'Token: gho_123456789012345678901234567890123456';
      const sanitized = logger.sanitize(text);
      expect(sanitized).toBe('Token: gho_***');
    });

    test('should sanitize ghu_ tokens (36 chars)', () => {
      const text = 'Token: ghu_123456789012345678901234567890123456';
      const sanitized = logger.sanitize(text);
      expect(sanitized).toBe('Token: ghu_***');
    });

    test('should sanitize ghs_ tokens (36 chars)', () => {
      const text = 'Token: ghs_123456789012345678901234567890123456';
      const sanitized = logger.sanitize(text);
      expect(sanitized).toBe('Token: ghs_***');
    });

    test('should sanitize ghr_ tokens (36 chars)', () => {
      const text = 'Token: ghr_123456789012345678901234567890123456';
      const sanitized = logger.sanitize(text);
      expect(sanitized).toBe('Token: ghr_***');
    });

    test('should sanitize multiple tokens', () => {
      const ghpToken = '123456789012345678901234567890123456';
      const patToken = '1234567890123456789012345678901234567890123456789012345678901234567890123456789012';
      const text = `Tokens: ghp_${ghpToken} and github_pat_${patToken}`;
      const sanitized = logger.sanitize(text);
      expect(sanitized).toBe('Tokens: ghp_*** and github_pat_***');
    });

    test('should not modify text without tokens', () => {
      const text = 'No tokens here, just regular text';
      const sanitized = logger.sanitize(text);
      expect(sanitized).toBe(text);
    });

    test('should handle empty string', () => {
      const sanitized = logger.sanitize('');
      expect(sanitized).toBe('');
    });
  });
});
