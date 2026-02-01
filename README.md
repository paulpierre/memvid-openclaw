# memvid-openclaw

**Memvid Memory Plugin for Clawdbot** — Single-file AI memory with instant retrieval and long-term storage.

[![npm version](https://img.shields.io/npm/v/@paulpierre/memvid-openclaw)](https://www.npmjs.com/package/@paulpierre/memvid-openclaw)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

This plugin integrates [Memvid](https://memvid.com) into Clawdbot, providing:

- **Persistent Memory**: Store facts, preferences, decisions, and context in portable `.mv2` files
- **Instant Retrieval**: Sub-5ms local search with hybrid vector + BM25 ranking
- **Multiple Collections**: Organize memories by project, context, or any custom grouping
- **Auto-Capture** (optional): Automatically capture memories from conversations based on triggers

## Quick Install

### One-liner (curl | bash)

```bash
curl -fsSL https://raw.githubusercontent.com/paulpierre/memvid-openclaw/main/install.sh | bash
```

### Manual Install

```bash
# Install the plugin
clawdbot plugins install @paulpierre/memvid-openclaw

# Or install from GitHub
clawdbot plugins install https://github.com/paulpierre/memvid-openclaw.git

# Or clone and link for development
git clone https://github.com/paulpierre/memvid-openclaw.git
cd memvid-openclaw
npm install
npm run build
clawdbot plugins install -l .
```

## Configuration

Add to your `clawdbot.json`:

```json
{
  "plugins": {
    "entries": {
      "memvid": {
        "enabled": true,
        "config": {
          "storagePath": "~/.clawdbot/memvid",
          "defaultCollection": "memories",
          "embedding": {
            "provider": "local",
            "model": "bge-small-en-v1.5"
          },
          "search": {
            "topK": 10,
            "snippetChars": 200,
            "hybrid": true
          },
          "autoCapture": {
            "enabled": false,
            "triggers": ["preference", "decision", "important", "remember"]
          }
        }
      }
    }
  }
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `storagePath` | string | `~/.clawdbot/memvid` | Directory for `.mv2` memory files |
| `defaultCollection` | string | `memories` | Default collection for storing memories |
| `embedding.provider` | `local` \| `openai` | `local` | Embedding provider |
| `embedding.model` | string | `bge-small-en-v1.5` | Embedding model name |
| `search.topK` | number | `10` | Default number of search results |
| `search.snippetChars` | number | `200` | Characters in result snippets |
| `search.hybrid` | boolean | `true` | Use hybrid search (vector + BM25) |
| `autoCapture.enabled` | boolean | `false` | Auto-capture from conversations |
| `autoCapture.triggers` | string[] | `[...]` | Keywords that trigger auto-capture |

## Tools

The plugin provides these tools to the agent:

### `memvid_store`

Store a memory or fact in the knowledge base.

```typescript
// Parameters
{
  content: string;      // Required: Content to store
  title?: string;       // Optional: Title for the memory
  collection?: string;  // Optional: Collection name
  tags?: object;        // Optional: Key-value tags
}

// Example
await memvid_store({
  content: "User prefers dark mode in all applications",
  title: "UI Preference",
  tags: { category: "preference", priority: "high" }
});
```

### `memvid_search`

Search for relevant memories.

```typescript
// Parameters
{
  query: string;        // Required: Natural language query
  collection?: string;  // Optional: Specific collection
  topK?: number;        // Optional: Number of results
  tags?: object;        // Optional: Filter by tags
}

// Example
await memvid_search({
  query: "user preferences",
  topK: 5
});
```

### `memvid_list`

List all collections and their stats.

```typescript
await memvid_list();
// Returns: { collections: [{ name, path, sizeBytes, lastModified }] }
```

### `memvid_delete`

Delete a memory by ID (note: memvid uses append-only storage).

```typescript
await memvid_delete({ id: "memory-id", collection: "memories" });
```

## Local Embedding Models

For local embeddings, download the model files:

```bash
mkdir -p ~/.cache/memvid/text-models

# BGE-small (recommended, 384 dimensions)
curl -L 'https://huggingface.co/BAAI/bge-small-en-v1.5/resolve/main/onnx/model.onnx' \
  -o ~/.cache/memvid/text-models/bge-small-en-v1.5.onnx
curl -L 'https://huggingface.co/BAAI/bge-small-en-v1.5/resolve/main/tokenizer.json' \
  -o ~/.cache/memvid/text-models/bge-small-en-v1.5_tokenizer.json
```

## Development

```bash
# Clone and install
git clone https://github.com/paulpierre/memvid-openclaw.git
cd memvid-openclaw
npm install

# Build
npm run build

# Run tests
npm test

# Watch mode
npm run dev
```

### Project Structure

```
memvid-openclaw/
├── src/
│   ├── index.ts           # Plugin entry point
│   ├── memvid-manager.ts  # Core manager class
│   └── types.ts           # TypeScript definitions
├── tests/
│   └── memvid-manager.test.ts
├── clawdbot.plugin.json   # Plugin manifest
├── package.json
├── tsconfig.json
└── README.md
```

## How It Works

1. **Storage**: Memories are stored in `.mv2` files (memvid's capsule format) — portable, versioned, and self-contained.

2. **Collections**: Each collection is a separate `.mv2` file. Organize by project, context, or any grouping that makes sense.

3. **Search**: Uses hybrid search combining:
   - **Vector search**: Semantic similarity via embeddings
   - **BM25**: Keyword relevance ranking

4. **Auto-Capture**: When enabled, the plugin can automatically capture memories when trigger keywords appear in conversations.

## Integration with Clawdbot Memory Stack

This plugin complements other memory systems:

| System | Type | Best For |
|--------|------|----------|
| **Native Markdown** | Files | Human-readable logs, curated notes |
| **memvid** (this) | Binary | Fast retrieval, portable capsules |
| **mem0** | Remote | Cross-session entities, relationships |

Use them together for comprehensive agent memory.

## License

MIT — see [LICENSE](LICENSE)

## Links

- [Memvid Documentation](https://docs.memvid.com)
- [Clawdbot Documentation](https://docs.clawd.bot)
- [GitHub Issues](https://github.com/paulpierre/memvid-openclaw/issues)
