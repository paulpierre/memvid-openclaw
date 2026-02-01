# Testing memvid-openclaw

## Unit Tests

Run the test suite:

```bash
npm test
```

This runs 16 tests covering:
- Store operations (default collection, custom collection, with tags)
- Search operations (basic, with topK parameter)
- List collections
- Delete operations (existing and non-existent IDs)

## Manual Integration Test

### Option 1: Standalone Test Script

Create a test file:

```javascript
// test-manual.mjs
import { create } from '@memvid/sdk';

async function test() {
  console.log('Creating memory store...');
  const mv = await create('/tmp/test-memories.mv2');
  
  // Store a memory
  console.log('Storing memory...');
  await mv.put({
    title: 'Test Memory',
    label: 'test',
    text: 'This is a test memory to verify the plugin works.',
    tags: ['integration', 'test'],
  });
  
  // Search
  console.log('Searching...');
  const results = await mv.find('test memory');
  console.log('Results:', results);
  
  // Verify
  if (results.hits && results.hits.length > 0) {
    console.log('✅ SUCCESS: Memory stored and retrieved');
  } else {
    console.log('❌ FAILED: Could not retrieve memory');
  }
  
  await mv.seal();
}

test().catch(console.error);
```

Run it:

```bash
node test-manual.mjs
```

### Option 2: Test with Clawdbot

1. Install the plugin:
   ```bash
   clawdbot plugins install @paulpierre/memvid-openclaw
   ```

2. Restart the gateway:
   ```bash
   clawdbot gateway restart
   ```

3. Verify plugin loaded:
   ```bash
   clawdbot plugins list | grep memvid-openclaw
   ```
   
   Should show: `memvid-openclaw | loaded`

4. Test via chat or API:
   - Store: Tell Clawdbot "remember that my favorite color is blue"
   - Search: Ask Clawdbot "what's my favorite color?"
   
5. Check the .mv2 file was created:
   ```bash
   ls ~/.clawdbot/memvid/*.mv2
   ```

### Option 3: Direct Tool Test (if gateway running)

```bash
# Store
curl -X POST http://localhost:3000/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools.execute",
    "params": {
      "tool": "memvid_store",
      "params": {
        "content": "Test memory from curl",
        "title": "Curl Test"
      }
    }
  }'

# Search
curl -X POST http://localhost:3000/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools.execute",
    "params": {
      "tool": "memvid_search",
      "params": {
        "query": "curl test"
      }
    }
  }'
```

## Verifying It Works

Success indicators:
1. ✅ `npm test` passes all 16 tests
2. ✅ `.mv2` file created in storage path
3. ✅ Stored content can be retrieved via search
4. ✅ Plugin shows "loaded" in `clawdbot plugins list`

## Troubleshooting

### "tool.execute is not a function"
The plugin may conflict with a bundled memvid plugin. Try:
```bash
clawdbot plugins disable memvid
clawdbot gateway restart
```

### Plugin not loading
Check logs:
```bash
clawdbot logs | grep -i memvid
```

### Storage path issues
Default: `~/.clawdbot/memvid/`

Override in config:
```json
{
  "plugins": {
    "entries": {
      "memvid-openclaw": {
        "config": {
          "storagePath": "/custom/path"
        }
      }
    }
  }
}
```
