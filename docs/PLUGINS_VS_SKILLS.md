# Clawdbot Plugins vs Skills

This document explains the difference between Clawdbot **plugins** and **skills**, and when to use each.

## Quick Comparison

| Aspect | Plugin | Skill |
|--------|--------|-------|
| **What it is** | TypeScript code running inside Gateway | Markdown instructions + optional scripts |
| **Execution** | Native tools, background services | Agent interprets SKILL.md, calls `exec` |
| **Installation** | `clawdbot plugins install` | Copy to skills folder |
| **Auto-capture** | ✅ Can hook into events | ❌ Manual only |
| **Complexity** | Higher (code, build, tests) | Lower (just docs + scripts) |
| **Best for** | Deep integration, background tasks | CLI wrappers, instructions |

---

## What is a Plugin?

A **plugin** is TypeScript code that runs **inside the Clawdbot Gateway process**. It can:

- Register **native tools** that appear directly in the agent's tool list
- Run **background services** (start on boot, stop on shutdown)
- Hook into **Gateway events** (message received, session start, etc.)
- Register **RPC methods** and **HTTP handlers**
- Add **CLI commands** (`clawdbot <your-command>`)

### Plugin Structure

```
my-plugin/
├── src/
│   └── index.ts          # Plugin entry point
├── clawdbot.plugin.json  # Manifest (required)
├── package.json          # npm metadata
└── tsconfig.json
```

### Plugin Manifest (clawdbot.plugin.json)

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "configSchema": {
    "type": "object",
    "properties": {
      "apiKey": { "type": "string" }
    }
  }
}
```

### Plugin Entry Point

```typescript
export const id = 'my-plugin';

export function register(api) {
  // Register a tool
  api.registerTool({
    name: 'my_tool',
    description: 'Does something useful',
    parameters: { /* JSON Schema */ },
    handler: async (params) => {
      return { ok: true, result: 'done' };
    },
  });

  // Register a background service
  api.registerService({
    id: 'my-service',
    start: async () => { /* on gateway start */ },
    stop: async () => { /* on gateway stop */ },
  });
}
```

### Plugin Installation

```bash
# From npm
clawdbot plugins install @scope/my-plugin

# From GitHub
clawdbot plugins install https://github.com/user/my-plugin.git

# Local development (linked)
clawdbot plugins install -l ./my-plugin

# Enable/disable
clawdbot plugins enable my-plugin
clawdbot plugins disable my-plugin
```

### Plugin Configuration

```json
// clawdbot.json
{
  "plugins": {
    "entries": {
      "my-plugin": {
        "enabled": true,
        "config": {
          "apiKey": "xxx"
        }
      }
    }
  }
}
```

---

## What is a Skill?

A **skill** is a set of **instructions** (in `SKILL.md`) that tells the agent how to use an external tool. The agent reads the skill and executes shell commands via `exec`.

### Skill Structure

```
my-skill/
├── SKILL.md              # Instructions (required)
├── scripts/              # Optional helper scripts
│   └── helper.sh
└── README.md             # Optional docs
```

### Skill File (SKILL.md)

```markdown
---
name: my-skill
description: Interact with MyTool CLI
---

# my-skill

Use `mytool` for X, Y, Z.

## Commands

- Search: `mytool search "query"`
- Create: `mytool create --name "foo"`

## Examples

```bash
mytool search "hello world" --limit 10
```
```

### How Skills Work

1. Agent receives a task that matches a skill's description
2. Agent reads `SKILL.md` to understand how to use the tool
3. Agent calls `exec` to run shell commands
4. Agent interprets output and responds

### Skill Installation

Skills are typically bundled with Clawdbot or installed via ClawdHub:

```bash
# From ClawdHub
clawdhub install my-skill

# Manual: copy to skills folder
cp -r my-skill ~/.clawdbot/skills/
```

---

## When to Use Each

### Use a **Plugin** when:

- You need **native tools** (not shell commands)
- You want **background processing** (auto-capture, webhooks)
- You need to **hook into events** (message received, etc.)
- Performance matters (no exec overhead)
- You want **deep integration** with Clawdbot internals

### Use a **Skill** when:

- You're wrapping an **existing CLI tool**
- Instructions are simple and don't need background services
- You want **quick iteration** (just edit markdown)
- The tool is already installed and works via shell
- You don't need event hooks or auto-capture

---

## memvid-openclaw: Why a Plugin?

This project is a **plugin** (not a skill) because:

1. **Native tools**: `memvid_store`, `memvid_search` are registered as real Clawdbot tools, not shell wrappers
2. **Background service**: Initializes on Gateway start, manages collection lifecycle
3. **Auto-capture potential**: Can hook into message events to auto-store memories
4. **Performance**: Direct SDK calls, no exec/shell overhead
5. **Type safety**: Full TypeScript with proper error handling

If memvid were just a CLI tool, a skill would suffice:

```markdown
# memvid skill (hypothetical)

Store: `memvid put "content" --collection memories`
Search: `memvid find "query" --k 10`
```

But the SDK integration and background service requirements make a plugin the right choice.

---

## Further Reading

- [Clawdbot Plugin Docs](https://docs.clawd.bot/plugin)
- [Plugin Manifest Reference](https://docs.clawd.bot/plugins/manifest)
- [Plugin Agent Tools](https://docs.clawd.bot/plugins/agent-tools)
- [Skills Documentation](https://docs.clawd.bot/skills)
