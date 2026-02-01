/**
 * Memvid Memory Plugin for Clawdbot
 * 
 * Provides single-file AI memory with instant retrieval and long-term storage.
 * Uses memvid's .mv2 format for portable, versioned memory capsules.
 */

import { MemvidManager } from './memvid-manager.js';
import type { MemvidConfig, MemvidStoreParams, MemvidSearchParams, MemvidSearchResult } from './types.js';

export const id = 'memvid-openclaw';
export const name = 'Memvid Memory';

interface PluginApi {
  logger: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
    debug: (msg: string) => void;
  };
  config: {
    plugins?: {
      entries?: {
        'memvid-openclaw'?: {
          config?: MemvidConfig;
        };
      };
    };
  };
  registerTool: (tool: ToolDefinition) => void;
  registerService: (service: ServiceDefinition) => void;
}

interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (params: Record<string, unknown>, ctx: unknown) => Promise<unknown>;
}

interface ServiceDefinition {
  id: string;
  start: () => void | Promise<void>;
  stop: () => void | Promise<void>;
}

let manager: MemvidManager | null = null;

export function register(api: PluginApi): void {
  const config = api.config.plugins?.entries?.['memvid-openclaw']?.config ?? {};
  
  api.logger.info('Memvid plugin initializing...');

  // Initialize the memvid manager
  manager = new MemvidManager(config, api.logger);

  // Register the memvid_store tool
  api.registerTool({
    name: 'memvid_store',
    description: 'Store a memory or fact in the memvid knowledge base. Use for important information, preferences, decisions, or facts that should be remembered long-term.',
    parameters: {
      type: 'object',
      required: ['content'],
      properties: {
        content: {
          type: 'string',
          description: 'The content to store (fact, preference, decision, etc.)',
        },
        title: {
          type: 'string',
          description: 'Optional title for the memory',
        },
        collection: {
          type: 'string',
          description: 'Collection name (defaults to configured default)',
        },
        tags: {
          type: 'object',
          additionalProperties: { type: 'string' },
          description: 'Key-value tags for categorization',
        },
      },
    },
    execute: async (_id: string, params: Record<string, unknown>) => {
      if (!manager) {
        return { ok: false, error: 'Memvid manager not initialized' };
      }
      
      const storeParams: MemvidStoreParams = {
        content: params.content as string,
        title: params.title as string | undefined,
        collection: params.collection as string | undefined,
        tags: params.tags as Record<string, string> | undefined,
      };

      return manager.store(storeParams);
    },
  });

  // Register the memvid_search tool
  api.registerTool({
    name: 'memvid_search',
    description: 'Search the memvid knowledge base for relevant memories and facts. Uses hybrid search (vector + BM25) for best results.',
    parameters: {
      type: 'object',
      required: ['query'],
      properties: {
        query: {
          type: 'string',
          description: 'Search query (natural language)',
        },
        collection: {
          type: 'string',
          description: 'Collection to search (defaults to all)',
        },
        topK: {
          type: 'number',
          description: 'Number of results to return (default: 10)',
        },
        tags: {
          type: 'object',
          additionalProperties: { type: 'string' },
          description: 'Filter by tags',
        },
      },
    },
    execute: async (_id: string, params: Record<string, unknown>) => {
      if (!manager) {
        return { ok: false, error: 'Memvid manager not initialized' };
      }

      const searchParams: MemvidSearchParams = {
        query: params.query as string,
        collection: params.collection as string | undefined,
        topK: params.topK as number | undefined,
        tags: params.tags as Record<string, string> | undefined,
      };

      return manager.search(searchParams);
    },
  });

  // Register the memvid_list tool
  api.registerTool({
    name: 'memvid_list',
    description: 'List all memvid collections and their stats.',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async (_id: string) => {
      if (!manager) {
        return { ok: false, error: 'Memvid manager not initialized' };
      }

      return manager.listCollections();
    },
  });

  // Register the memvid_delete tool
  api.registerTool({
    name: 'memvid_delete',
    description: 'Delete a memory by ID from a collection.',
    parameters: {
      type: 'object',
      required: ['id'],
      properties: {
        id: {
          type: 'string',
          description: 'Memory ID to delete',
        },
        collection: {
          type: 'string',
          description: 'Collection name (defaults to configured default)',
        },
      },
    },
    execute: async (_id: string, params: Record<string, unknown>) => {
      if (!manager) {
        return { ok: false, error: 'Memvid manager not initialized' };
      }

      return manager.delete(
        params.id as string,
        params.collection as string | undefined
      );
    },
  });

  // Register background service for auto-capture (if enabled)
  api.registerService({
    id: 'memvid-service',
    start: async () => {
      api.logger.info('Memvid service started');
      await manager?.initialize();
    },
    stop: async () => {
      api.logger.info('Memvid service stopping');
      await manager?.shutdown();
    },
  });

  api.logger.info('Memvid plugin registered successfully');
}

export default register;
