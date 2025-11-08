# Datastar on-cleanup Plugin

Execute expressions when elements are removed from the DOM.

Perfect for cleanup tasks, logging, and state management.

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

The plugin leverages Datastar's built-in MutationObserver to detect DOM changes. When an element with `data-on-cleanup` is removed, the expression executes automatically.

This works for:
- Manual removal (`element.remove()`)
- Parent removal (children cleanup automatically)
- DOM morphing/patching

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
