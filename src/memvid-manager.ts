/**
 * MemvidManager - Wrapper around @memvid/sdk for Clawdbot integration
 */

import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import type {
  MemvidConfig,
  MemvidStoreParams,
  MemvidStoreResult,
  MemvidSearchParams,
  MemvidSearchResult,
  MemvidListResult,
  MemvidDeleteResult,
  Logger,
} from './types.js';

// SDK types (matching @memvid/sdk)
interface PutInput {
  title?: string;
  label?: string;
  metadata?: Record<string, unknown>;
  text?: string;
  tags?: string[];
  uri?: string;
}

interface FindInput {
  mode?: 'lex' | 'sem' | 'auto';
  k?: number;
  snippetChars?: number;
}

interface FindHit {
  frameId?: string;
  text?: string;
  snippet?: string;
  score?: number;
  title?: string;
  metadata?: Record<string, unknown>;
  timestamp?: number;
}

interface FindResult {
  hits?: FindHit[];
  total?: number;
}

interface MemvidInstance {
  path: () => Promise<string>;
  put: (data: PutInput) => Promise<string>;
  remove: (frameId: string) => Promise<number>;
  find: (query: string, opts?: FindInput) => Promise<FindResult>;
  seal: () => Promise<void>;
  stats: () => Promise<{ frameCount?: number; totalBytes?: number }>;
}

type CreateFn = (filename: string) => Promise<MemvidInstance>;
type OpenFn = (filename: string) => Promise<MemvidInstance>;

// SDK functions (loaded dynamically)
let sdkCreate: CreateFn | null = null;
let sdkOpen: OpenFn | null = null;

export class MemvidManager {
  private config: Required<MemvidConfig>;
  private logger: Logger;
  private collections: Map<string, MemvidInstance> = new Map();
  private initialized = false;

  constructor(config: Partial<MemvidConfig>, logger: Logger) {
    // Apply defaults
    this.config = {
      storagePath: config.storagePath ?? join(homedir(), '.clawdbot', 'memvid'),
      defaultCollection: config.defaultCollection ?? 'memories',
      autoCapture: {
        enabled: config.autoCapture?.enabled ?? false,
        triggers: config.autoCapture?.triggers ?? ['preference', 'decision', 'important', 'remember'],
      },
      embedding: {
        provider: config.embedding?.provider ?? 'local',
        model: config.embedding?.model ?? 'bge-small-en-v1.5',
      },
      search: {
        topK: config.search?.topK ?? 10,
        snippetChars: config.search?.snippetChars ?? 200,
        hybrid: config.search?.hybrid ?? true,
      },
    };
    this.logger = logger;
  }

  /**
   * Initialize the memvid manager and load the SDK
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Ensure storage directory exists
      if (!existsSync(this.config.storagePath)) {
        mkdirSync(this.config.storagePath, { recursive: true });
        this.logger.info(`Created memvid storage directory: ${this.config.storagePath}`);
      }

      // Dynamic import of @memvid/sdk
      const memvidModule = await import('@memvid/sdk');
      sdkCreate = memvidModule.create as unknown as CreateFn;
      sdkOpen = memvidModule.open as unknown as OpenFn;

      if (!sdkCreate || !sdkOpen) {
        throw new Error('Failed to load create/open functions from @memvid/sdk');
      }

      // Load existing collections
      await this.loadExistingCollections();

      this.initialized = true;
      this.logger.info(`Memvid initialized with ${this.collections.size} collection(s)`);
    } catch (error) {
      this.logger.error(`Failed to initialize memvid: ${error}`);
      throw error;
    }
  }

  /**
   * Load existing .mv2 files from the storage directory
   */
  private async loadExistingCollections(): Promise<void> {
    if (!sdkOpen) return;
    
    const files = readdirSync(this.config.storagePath);
    for (const file of files) {
      if (file.endsWith('.mv2')) {
        const collectionName = file.replace('.mv2', '');
        const collectionPath = join(this.config.storagePath, file);
        try {
          const mem = await sdkOpen(collectionPath);
          this.collections.set(collectionName, mem);
          this.logger.debug(`Loaded collection: ${collectionName}`);
        } catch (error) {
          this.logger.warn(`Failed to load collection ${collectionName}: ${error}`);
        }
      }
    }
  }

  /**
   * Get or create a collection by name
   */
  private async getCollection(name?: string): Promise<MemvidInstance> {
    const collectionName = name ?? this.config.defaultCollection;
    
    if (this.collections.has(collectionName)) {
      return this.collections.get(collectionName)!;
    }

    if (!sdkCreate || !sdkOpen) {
      throw new Error('SDK not initialized');
    }

    // Create new collection
    const collectionPath = join(this.config.storagePath, `${collectionName}.mv2`);
    let mem: MemvidInstance;

    if (existsSync(collectionPath)) {
      mem = await sdkOpen(collectionPath);
    } else {
      mem = await sdkCreate(collectionPath);
    }

    this.collections.set(collectionName, mem);
    this.logger.info(`Created/opened collection: ${collectionName}`);
    return mem;
  }

  /**
   * Store a memory in the collection
   */
  async store(params: MemvidStoreParams): Promise<MemvidStoreResult> {
    try {
      await this.ensureInitialized();
      const mem = await this.getCollection(params.collection);

      // Build put input
      const putInput: PutInput = {
        text: params.content,
      };
      
      if (params.title) putInput.title = params.title;
      if (params.tags) {
        putInput.tags = Object.entries(params.tags).map(([k, v]) => `${k}:${v}`);
        putInput.metadata = params.tags;
      }

      // Store the content and get frame ID
      const frameId = await mem.put(putInput);
      
      this.logger.debug(`Stored memory in ${params.collection ?? this.config.defaultCollection}: ${params.title ?? params.content.slice(0, 50)}`);
      
      return {
        ok: true,
        id: frameId,
        collection: params.collection ?? this.config.defaultCollection,
      };
    } catch (error) {
      this.logger.error(`Failed to store memory: ${error}`);
      return {
        ok: false,
        error: String(error),
      };
    }
  }

  /**
   * Search for memories
   */
  async search(params: MemvidSearchParams): Promise<MemvidSearchResult> {
    try {
      await this.ensureInitialized();

      const topK = params.topK ?? this.config.search.topK;
      const snippetChars = this.config.search.snippetChars;

      const findOpts: FindInput = {
        k: topK,
        snippetChars,
        mode: this.config.search.hybrid ? 'auto' : 'lex',
      };

      // If collection specified, search only that one
      if (params.collection) {
        const mem = await this.getCollection(params.collection);
        const response = await mem.find(params.query, findOpts);

        return {
          ok: true,
          hits: response.hits?.map((hit) => ({
            id: hit.frameId ?? `hit-${Math.random().toString(36).slice(2, 8)}`,
            score: hit.score ?? 0,
            title: hit.title,
            text: hit.text ?? '',
            snippet: hit.snippet ?? hit.text?.slice(0, snippetChars) ?? '',
            tags: hit.metadata as Record<string, string> | undefined,
            timestamp: hit.timestamp ? new Date(hit.timestamp * 1000).toISOString() : new Date().toISOString(),
          })) ?? [],
          total: response.total ?? response.hits?.length ?? 0,
          query: params.query,
        };
      }

      // Search across all collections
      const allHits: MemvidSearchResult['hits'] = [];
      for (const [collectionName, mem] of this.collections) {
        try {
          const response = await mem.find(params.query, findOpts);

          for (const hit of response.hits ?? []) {
            allHits!.push({
              id: hit.frameId ?? `hit-${Math.random().toString(36).slice(2, 8)}`,
              score: hit.score ?? 0,
              title: hit.title,
              text: hit.text ?? '',
              snippet: hit.snippet ?? hit.text?.slice(0, snippetChars) ?? '',
              tags: { ...(hit.metadata as Record<string, string>), _collection: collectionName },
              timestamp: hit.timestamp ? new Date(hit.timestamp * 1000).toISOString() : new Date().toISOString(),
            });
          }
        } catch (error) {
          this.logger.warn(`Search failed in collection ${collectionName}: ${error}`);
        }
      }

      // Sort by score and take topK
      allHits!.sort((a, b) => b.score - a.score);
      const hits = allHits!.slice(0, topK);

      return {
        ok: true,
        hits,
        total: allHits!.length,
        query: params.query,
      };
    } catch (error) {
      this.logger.error(`Search failed: ${error}`);
      return {
        ok: false,
        error: String(error),
      };
    }
  }

  /**
   * List all collections and their stats
   */
  async listCollections(): Promise<MemvidListResult> {
    try {
      await this.ensureInitialized();

      const collections: MemvidListResult['collections'] = [];
      for (const [name, mem] of this.collections) {
        const path = join(this.config.storagePath, `${name}.mv2`);
        const fileStats = statSync(path);
        
        let docCount = 0;
        try {
          const stats = await mem.stats();
          docCount = stats.frameCount ?? 0;
        } catch {
          // Stats might not be available
        }
        
        collections!.push({
          name,
          path,
          documentCount: docCount,
          sizeBytes: fileStats.size,
          lastModified: fileStats.mtime.toISOString(),
        });
      }

      return {
        ok: true,
        collections,
      };
    } catch (error) {
      this.logger.error(`Failed to list collections: ${error}`);
      return {
        ok: false,
        error: String(error),
      };
    }
  }

  /**
   * Delete a memory by ID
   */
  async delete(id: string, collection?: string): Promise<MemvidDeleteResult> {
    try {
      await this.ensureInitialized();
      const mem = await this.getCollection(collection);
      
      // Use the SDK's remove method (soft delete/tombstone)
      await mem.remove(id);
      
      this.logger.debug(`Deleted memory ${id} from ${collection ?? this.config.defaultCollection}`);
      
      return {
        ok: true,
        deleted: true,
      };
    } catch (error) {
      this.logger.error(`Delete failed: ${error}`);
      return {
        ok: false,
        error: String(error),
      };
    }
  }

  /**
   * Ensure the manager is initialized before operations
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown(): Promise<void> {
    // Seal all collections to ensure data is persisted
    for (const [name, mem] of this.collections) {
      try {
        await mem.seal();
        this.logger.debug(`Sealed collection: ${name}`);
      } catch (error) {
        this.logger.warn(`Failed to seal collection ${name}: ${error}`);
      }
    }
    this.collections.clear();
    this.initialized = false;
    this.logger.info('Memvid manager shutdown complete');
  }
}
