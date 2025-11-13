# Datastar on-cleanup Plugin

Execute expressions when cleanup is triggered.

Cleanup occurs when elements are removed, attributes are removed or changed, or during DOM morphing operations.

## Quick Start

```typescript
import * as datastar from './datastar.js'
import { install } from './on-cleanup.js'

// Install the plugin
install(datastar)
```

Then use in HTML:

```html
<div data-on-cleanup="console.log('Goodbye!')">
  Will log when removed
</div>
```

> **Note:** For a more robust solution to execute expressions on element removal, check out [data-on-remove](https://github.com/regaez/data-on-remove).

## Examples

### Basic Cleanup

```html
<div data-on-cleanup="console.log('Element removed')">
  Content
</div>
```

### Timer Cleanup

```html
<div
  data-init="$timer = setInterval(() => $count++, 1000)"
  data-on-cleanup="clearInterval($timer)">
  Timer: <span data-text="$count"></span>
</div>
```

## How It Works

The plugin leverages Datastar's built-in cleanup mechanism to detect when cleanup should occur. The expression executes automatically when:

- **Element removal**: Manual removal (`element.remove()`), parent removal, or `removeChild()`
- **Attribute removal**: The `data-on-cleanup` attribute is removed from the element
- **Attribute value change**: The expression is updated (old cleanup runs, then new one is registered)
- **DOM morphing**: Elements are replaced during server-driven updates (unless they have persistent IDs)
- **Server patches**: Server sends `patch-elements` with `mode=remove`

When cleanup executes, signal updates are automatically batched for optimal performance.

> 📖 **Want to know more?** See [CLEANUP_MECHANISM_ANALYSIS.md](./CLEANUP_MECHANISM_ANALYSIS.md) for a detailed explanation of how Datastar's cleanup mechanism works under the hood.

## Building from Source

First, clone the Datastar repository for type definitions:

```bash
git clone https://github.com/starfederation/datastar.git
```

Then build:

```bash
./build.sh
```

This creates:
- `dist/on-cleanup.js` (552 bytes)
- `dist/on-cleanup.min.js` (234 bytes)

Requirements: [esbuild](https://esbuild.github.io/) installed globally

## Files

```
datastar-on-cleanup/
├── on-cleanup.ts           # Source code
├── build.sh                # Build script
├── dist/
│   ├── on-cleanup.js       # Non-minified
│   └── on-cleanup.min.js   # Minified
├── examples/
│   └── simple.html         # Demo
├── README.md               # This file
└── LICENSE                 # MIT
```

## License

MIT
