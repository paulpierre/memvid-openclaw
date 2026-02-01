/**
 * Type definitions for the Memvid Clawdbot plugin
 */

export interface MemvidConfig {
  /** Path to store memvid files (defaults to ~/.clawdbot/memvid) */
  storagePath?: string;
  
  /** Default collection name for storing memories */
  defaultCollection?: string;
  
  /** Auto-capture configuration */
  autoCapture?: {
    enabled?: boolean;
    triggers?: string[];
  };
  
  /** Embedding configuration */
  embedding?: {
    provider?: 'local' | 'openai';
    model?: string;
  };
  
  /** Search configuration */
  search?: {
    topK?: number;
    snippetChars?: number;
    hybrid?: boolean;
  };
}

export interface MemvidStoreParams {
  /** Content to store */
  content: string;
  
  /** Optional title for the memory */
  title?: string;
  
  /** Collection name */
  collection?: string;
  
  /** Key-value tags for categorization */
  tags?: Record<string, string>;
}

export interface MemvidStoreResult {
  ok: boolean;
  id?: string;
  collection?: string;
  error?: string;
}

export interface MemvidSearchParams {
  /** Search query */
  query: string;
  
  /** Collection to search */
  collection?: string;
  
  /** Number of results */
  topK?: number;
  
  /** Filter by tags */
  tags?: Record<string, string>;
}

export interface MemvidSearchHit {
  id: string;
  score: number;
  title?: string;
  text: string;
  snippet: string;
  tags?: Record<string, string>;
  timestamp: string;
}

export interface MemvidSearchResult {
  ok: boolean;
  hits?: MemvidSearchHit[];
  total?: number;
  query?: string;
  error?: string;
}

export interface MemvidCollectionInfo {
  name: string;
  path: string;
  documentCount: number;
  sizeBytes: number;
  lastModified: string;
}

export interface MemvidListResult {
  ok: boolean;
  collections?: MemvidCollectionInfo[];
  error?: string;
}

export interface MemvidDeleteResult {
  ok: boolean;
  deleted?: boolean;
  error?: string;
}

export interface Logger {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
  debug: (msg: string) => void;
}
