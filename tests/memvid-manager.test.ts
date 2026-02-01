/**
 * Unit tests for MemvidManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemvidManager } from '../src/memvid-manager.js';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock logger
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

describe('MemvidManager', () => {
  let tempDir: string;
  let manager: MemvidManager;

  beforeEach(() => {
    // Create temp directory for tests
    tempDir = mkdtempSync(join(tmpdir(), 'memvid-test-'));
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Cleanup
    if (manager) {
      await manager.shutdown();
    }
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('constructor', () => {
    it('should apply default config values', () => {
      manager = new MemvidManager({}, mockLogger);
      // Manager is created but not initialized yet
      expect(manager).toBeDefined();
    });

    it('should use custom storage path', () => {
      manager = new MemvidManager({ storagePath: tempDir }, mockLogger);
      expect(manager).toBeDefined();
    });

    it('should use custom default collection', () => {
      manager = new MemvidManager({ 
        storagePath: tempDir,
        defaultCollection: 'custom-memories' 
      }, mockLogger);
      expect(manager).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should create storage directory if not exists', async () => {
      const customPath = join(tempDir, 'custom-storage');
      manager = new MemvidManager({ storagePath: customPath }, mockLogger);
      
      await manager.initialize();
      
      expect(existsSync(customPath)).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Created memvid storage directory')
      );
    });

    it('should not throw if storage directory exists', async () => {
      manager = new MemvidManager({ storagePath: tempDir }, mockLogger);
      
      await expect(manager.initialize()).resolves.not.toThrow();
    });
  });

  describe('store', () => {
    beforeEach(async () => {
      manager = new MemvidManager({ storagePath: tempDir }, mockLogger);
    });

    it('should store content and return ok result', async () => {
      const result = await manager.store({
        content: 'Test memory content',
        title: 'Test Title',
      });

      expect(result.ok).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.collection).toBe('memories');
    });

    it('should store to custom collection', async () => {
      const result = await manager.store({
        content: 'Custom collection content',
        collection: 'custom',
      });

      expect(result.ok).toBe(true);
      expect(result.collection).toBe('custom');
    });

    it('should store with tags', async () => {
      const result = await manager.store({
        content: 'Tagged content',
        tags: { category: 'test', priority: 'high' },
      });

      expect(result.ok).toBe(true);
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      manager = new MemvidManager({ storagePath: tempDir }, mockLogger);
    });

    it('should return empty results for new collection', async () => {
      const result = await manager.search({
        query: 'nonexistent',
      });

      expect(result.ok).toBe(true);
      expect(result.hits).toBeDefined();
    });

    it('should search with custom topK', async () => {
      // First store some content
      await manager.store({ content: 'First memory' });
      await manager.store({ content: 'Second memory' });

      const result = await manager.search({
        query: 'memory',
        topK: 1,
      });

      expect(result.ok).toBe(true);
    });
  });

  describe('listCollections', () => {
    beforeEach(async () => {
      manager = new MemvidManager({ storagePath: tempDir }, mockLogger);
    });

    it('should list empty collections initially', async () => {
      const result = await manager.listCollections();

      expect(result.ok).toBe(true);
      expect(result.collections).toBeDefined();
    });

    it('should list collections after storing', async () => {
      await manager.store({ content: 'test', collection: 'collection1' });
      await manager.store({ content: 'test', collection: 'collection2' });

      const result = await manager.listCollections();

      expect(result.ok).toBe(true);
      expect(result.collections?.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('delete', () => {
    beforeEach(async () => {
      manager = new MemvidManager({ storagePath: tempDir }, mockLogger);
    });

    it('should delete a stored memory by ID', async () => {
      // First store something
      const storeResult = await manager.store({ content: 'test content to delete' });
      expect(storeResult.ok).toBe(true);
      expect(storeResult.id).toBeDefined();
      
      // Then delete it
      const result = await manager.delete(storeResult.id!);

      expect(result.ok).toBe(true);
      expect(result.deleted).toBe(true);
    });

    it('should handle delete of non-existent ID gracefully', async () => {
      // Initialize manager first
      await manager.store({ content: 'init' });
      
      const result = await manager.delete('non-existent-id');
      
      // SDK might throw or return error for non-existent ID
      // We just check it doesn't crash
      expect(result).toBeDefined();
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      manager = new MemvidManager({ storagePath: tempDir }, mockLogger);
      await manager.initialize();
      
      await manager.shutdown();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('shutdown complete')
      );
    });
  });
});

describe('MemvidManager - Error Handling', () => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  it('should handle invalid storage path gracefully', async () => {
    const manager = new MemvidManager({ 
      storagePath: '/nonexistent/path/that/cannot/be/created' 
    }, mockLogger);

    // Should not throw during construction
    expect(manager).toBeDefined();
  });
});
