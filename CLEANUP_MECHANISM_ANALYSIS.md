# Datastar Cleanup Mechanism Analysis

## Overview

The Datastar cleanup mechanism allows attribute plugins to register cleanup functions that execute when elements are removed from the DOM or when their attributes are removed. This document provides a comprehensive analysis of how and when cleanup functions are executed.

## Cleanup API Reference

### Public API for Plugin Authors

The Datastar cleanup API is exposed through the attribute plugin system. Plugin authors interact with cleanup through the `attribute` function and the `AttributePlugin` type.

#### attribute() Function

**Location:** `engine.ts:58`

```typescript
export const attribute = <R extends Requirement, B extends boolean>(
  plugin: AttributePlugin<R, B>,
): void
```

**Purpose:** Registers an attribute plugin with the Datastar engine.

#### AttributePlugin Type

**Location:** `types.ts:77-86`

```typescript
export type AttributePlugin<
  R extends Requirement = Requirement,
  RxReturn extends boolean = boolean,
> = {
  name: string
  apply: (ctx: AttributeContext<R, RxReturn>) => void | (() => void)
  requirement?: R
  returnsValue?: RxReturn
  argNames?: string[]
}
```

**Key property for cleanup:**
- `apply`: Function that receives an `AttributeContext` and optionally returns a cleanup function

#### Cleanup Function Signature

```typescript
() => void
```

**Characteristics:**
- Takes no parameters
- Returns nothing (void)
- Called automatically by Datastar when cleanup is needed
- Should be idempotent (safe to call multiple times)
- Should not throw errors

#### AttributeContext

**Location:** `types.ts:66-75`

```typescript
export type AttributeContext<
  R extends Requirement = Requirement,
  RxReturn extends boolean = boolean,
> = {
  el: HTMLOrSVG              // The element the attribute is on
  mods: Modifiers            // Modifiers parsed from the attribute (e.g., __prevent)
  rawKey: string             // Full attribute key including modifiers
  evt?: Event                // Event object (for event-based attributes)
  error: ErrorFn             // Error helper function
  key?: string               // The attribute key part (e.g., "click" from "on:click")
  value?: string             // The attribute value (the expression)
  rx?: (...args: any[]) => any  // Reactive expression executor
}
```

**Note:** The context is only available during the `apply` call. The cleanup function receives no parameters and should capture needed values via closure.

### Basic Usage Pattern

```typescript
import { attribute } from '@engine'

attribute({
  name: 'my-plugin',
  requirement: {
    key: 'denied',
    value: 'must'
  },
  apply({ el, value, rx }) {
    // Setup code runs when attribute is applied
    const resource = setupResource(el, value)

    // Return cleanup function (optional)
    return () => {
      // Cleanup code runs when element/attribute is removed
      cleanupResource(resource)
    }
  }
})
```

### Advanced Usage Patterns

#### 1. Cleanup with Event Listeners

```typescript
attribute({
  name: 'on',
  requirement: 'must',
  argNames: ['evt'],
  apply({ el, key, mods, rx }) {
    const target = mods.has('window') ? window : el
    const callback = (evt) => {
      rx(evt)
    }
    const eventName = key

    target.addEventListener(eventName, callback)

    return () => {
      target.removeEventListener(eventName, callback)
    }
  }
})
```

#### 2. Cleanup with Timers

```typescript
attribute({
  name: 'on-interval',
  requirement: { key: 'denied', value: 'must' },
  apply({ rx, mods }) {
    const duration = getDuration(mods)
    const intervalId = setInterval(() => {
      rx()
    }, duration)

    return () => {
      clearInterval(intervalId)
    }
  }
})
```

#### 3. Cleanup with Observers

```typescript
attribute({
  name: 'on-intersect',
  requirement: { key: 'denied', value: 'must' },
  apply({ el, rx, mods }) {
    const options = parseOptions(mods)
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          rx(entry)
        }
      }
    }, options)

    observer.observe(el)

    return () => {
      observer.disconnect()
    }
  }
})
```

#### 4. Cleanup with Reactive Effects

```typescript
import { effect } from '@engine/signals'

attribute({
  name: 'effect',
  requirement: { key: 'denied', value: 'must' },
  apply({ rx }) {
    // effect() returns its own cleanup function
    return effect(rx)
  }
})
```

#### 5. Cleanup with Signal Updates

```typescript
attribute({
  name: 'on-cleanup',
  requirement: { key: 'denied', value: 'must' },
  apply({ rx }) {
    return () => {
      // Batch signal updates during cleanup
      beginBatch()
      rx()  // Execute user's expression
      endBatch()
    }
  }
})
```

#### 6. No Cleanup Needed

```typescript
attribute({
  name: 'text',
  requirement: { key: 'denied', value: 'must' },
  returnsValue: true,
  apply({ el, rx }) {
    // Use reactive effect for updates
    effect(() => {
      el.textContent = rx()
    })
    // effect() handles its own cleanup, we don't need to return anything
  }
})
```

### Cleanup Function Guidelines

#### DO:

✅ **Clean up all allocated resources**
```typescript
return () => {
  clearInterval(intervalId)
  observer.disconnect()
  target.removeEventListener(eventName, callback)
}
```

✅ **Make cleanup idempotent**
```typescript
let disposed = false
return () => {
  if (!disposed) {
    cleanup()
    disposed = true
  }
}
```

✅ **Handle null/undefined safely**
```typescript
return () => {
  if (subscription) {
    subscription.unsubscribe()
  }
}
```

✅ **Batch signal updates**
```typescript
return () => {
  beginBatch()
  $counter.value--
  $items.value = $items.value.filter(i => i.id !== id)
  endBatch()
}
```

✅ **Use closures to capture state**
```typescript
apply({ el, value }) {
  const timerId = setTimeout(() => {}, 1000)
  const listenerTarget = getTarget(el)

  return () => {
    clearTimeout(timerId)  // Captured timerId
    cleanup(listenerTarget)  // Captured listenerTarget
  }
}
```

#### DON'T:

❌ **Don't throw errors in cleanup**
```typescript
// Bad
return () => {
  throw new Error('Cleanup failed')
}

// Good
return () => {
  try {
    riskyCleanup()
  } catch (e) {
    console.error('Cleanup error:', e)
  }
}
```

❌ **Don't access potentially removed elements**
```typescript
// Bad
return () => {
  el.textContent = 'Removed'  // el may be removed
}

// Good
return () => {
  if (el.isConnected) {
    el.textContent = 'Removed'
  }
}
```

❌ **Don't perform async operations without care**
```typescript
// Bad
return async () => {
  await saveToServer()  // Cleanup is synchronous!
}

// Good
return () => {
  // Fire and forget, or use sync cleanup
  saveToServer().catch(console.error)
  // OR
  syncCleanup()
}
```

❌ **Don't rely on execution order**
```typescript
// Bad - assumes other cleanups haven't run
return () => {
  parentElement.style.display = 'none'  // Parent may be removed already
}

// Good - handle independently
return () => {
  if (el.isConnected && el.parentElement) {
    el.parentElement.style.display = 'none'
  }
}
```

### API Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Attribute Added to DOM                                   │
│    <div data-my-plugin="expression">                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. MutationObserver Detects Attribute                       │
│    or apply() called manually                               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Plugin's apply() Function Called                         │
│    const cleanup = plugin.apply(ctx)                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Cleanup Function Registered (if returned)                │
│    removals.set(el, new Map([[rawKey, cleanup]]))          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │  (Element exists in DOM)
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Cleanup Triggered By:                                    │
│    • Element removed from DOM                               │
│    • Attribute removed from element                         │
│    • Attribute value changed                                │
│    • Server patch with mode=remove                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Cleanup Function Executed                                │
│    cleanup()                                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Cleanup Removed from Registry                            │
│    removals.delete(el)                                      │
└─────────────────────────────────────────────────────────────┘
```

### Return Value Contract

The `apply` function can return:

1. **`void` (undefined)**: No cleanup needed
   ```typescript
   apply({ el, value }) {
     el.textContent = value
     // No return - no cleanup
   }
   ```

2. **Cleanup function `() => void`**: Cleanup will be executed
   ```typescript
   apply({ el }) {
     const handler = () => {}
     el.addEventListener('click', handler)
     return () => el.removeEventListener('click', handler)
   }
   ```

**Note:** The return value is checked with a simple truthiness check, so returning `null`, `false`, `0`, etc. will be treated as no cleanup.

## Core Architecture

### Cleanup Registry

The cleanup mechanism is managed through a centralized `removals` Map in `engine.ts:54`:

```typescript
const removals = new Map<HTMLOrSVG, Map<string, () => void>>()
```

**Structure:**
- **Outer Map Key:** The HTML/SVG element
- **Outer Map Value:** A Map of cleanup functions for that element
- **Inner Map Key:** The attribute's raw key (e.g., `on-cleanup`, `on:click__prevent`)
- **Inner Map Value:** The cleanup function to execute

### Registration Process

When an attribute plugin's `apply` function returns a function, it's automatically registered as a cleanup callback (`engine.ts:281-291`):

```typescript
const cleanup = plugin.apply(ctx)
if (cleanup) {
  let cleanups = removals.get(el)
  if (cleanups) {
    cleanups.get(rawKey)?.()  // Run previous cleanup if exists
  } else {
    cleanups = new Map()
    removals.set(el, cleanups)
  }
  cleanups.set(rawKey, cleanup)
}
```

**Key behaviors:**
1. If the element already has cleanup functions, the existing cleanup for that specific attribute is executed before the new one is registered
2. Multiple attributes on the same element can each have their own cleanup function
3. Only one cleanup function per attribute per element (new registrations replace old ones)

### Cleanup Execution

The core cleanup function (`engine.ts:104-115`):

```typescript
const cleanupEls = (els: Iterable<HTMLOrSVG>): void => {
  for (const el of els) {
    const cleanups = removals.get(el)
    // If removals has el, delete it and run all cleanup functions
    if (removals.delete(el)) {
      for (const cleanup of cleanups!.values()) {
        cleanup()
      }
      cleanups!.clear()
    }
  }
}
```

**Process:**
1. Iterate through all provided elements
2. Retrieve the cleanup Map for each element
3. Delete the element from the registry (prevents duplicate execution)
4. Execute all cleanup functions for that element
5. Clear the cleanup Map

## Circumstances When Cleanup is Executed

### 1. DOM Node Removal via MutationObserver

**Location:** `engine.ts:145-151`

**When:** Any time nodes are removed from the DOM through any means

```typescript
if (type === 'childList') {
  for (const node of removedNodes) {
    if (isHTMLOrSVG(node)) {
      cleanupEls([node])                               // Cleanup the removed node
      cleanupEls(node.querySelectorAll<HTMLOrSVG>('*')) // Cleanup all descendants
    }
  }
}
```

**Triggered by:**
- `element.remove()`
- `parentElement.removeChild(element)`
- `element.innerHTML = ''`
- `parent.replaceChildren()`
- User navigating away from a page
- Any DOM manipulation that removes nodes

**Important:** Both the removed element AND all its descendants have their cleanup functions executed.

### 2. Data Attribute Removal

**Location:** `engine.ts:159-177`

**When:** A `data-*` attribute is removed from an element (but the element remains in the DOM)

```typescript
if (type === 'attributes' && attributeName!.startsWith('data-')) {
  const key = attributeName!.slice(5)
  const value = target.getAttribute(attributeName!)
  if (value === null) {
    const cleanups = removals.get(target)
    if (cleanups) {
      cleanups.get(key)?.()  // Execute specific cleanup
      cleanups.delete(key)
    }
  }
}
```

**Triggered by:**
- `element.removeAttribute('data-on-cleanup')`
- `delete element.dataset.onCleanup`
- `element.dataset.onCleanup = null` (sets to undefined)
- Server patches that remove attributes

**Important:** Only the cleanup for the specific removed attribute is executed, not all cleanups for the element.

### 3. DOM Morphing Operations

**Location:** `morph.ts:271-278`

**When:** Elements are removed during morphing operations (typically from server responses)

```typescript
const removeNode = (node: Node): void => {
  ctxIdMap.has(node)
    ? moveBefore(ctxPantry, node, null)  // Move to pantry (NO cleanup)
    : node.parentNode?.removeChild(node)  // Remove (triggers cleanup)
}
```

**Critical distinction:**
- Elements with persistent IDs that may be reused are moved to a "pantry" and **do NOT** trigger cleanup
- Elements without persistent IDs are truly removed and **do** trigger cleanup via the MutationObserver

**The Pantry Mechanism:**

The "pantry" is a hidden div (`morph.ts:8-9`) that temporarily stores elements during morphing:

```typescript
const ctxPantry = document.createElement('div')
ctxPantry.hidden = true
```

Elements moved to the pantry:
- Retain all their state and event listeners
- Do not trigger cleanup functions
- Can be reinserted elsewhere in the DOM without reinitialization
- Are identified by having persistent IDs that exist in both old and new content

### 4. Attribute Re-application

**Location:** `engine.ts:283-285`

**When:** The same attribute is reapplied to an element (value changes)

```typescript
let cleanups = removals.get(el)
if (cleanups) {
  cleanups.get(rawKey)?.()  // Run old cleanup before new application
}
```

**Triggered by:**
- Changing `data-on-interval="console.log('old')"` to `data-on-interval="console.log('new')"`
- Programmatically updating `element.dataset.onInterval = 'newValue'`
- Server patches that update attribute values

**Flow:**
1. Old cleanup function executes (e.g., clears old interval)
2. New attribute value is processed
3. New cleanup function is registered (e.g., new interval is set)

### 5. Server-Driven Element Patching

**Location:** `patchElements.ts:173-176`

**When:** Server sends patch-elements instructions with `mode='remove'`

```typescript
case 'remove':
  for (const target of targets) {
    target.remove()  // Triggers cleanup via MutationObserver
  }
```

**Server response example:**
```
datastar-patch-elements mode=remove selector=#user-123
```

This removes the element from the DOM, which triggers the MutationObserver and executes all cleanup functions.

## Examples of Plugins Using Cleanup

### 1. on-cleanup Plugin

**File:** Custom plugin for executing expressions on removal

```typescript
apply({ rx }) {
  const callback = () => {
    beginBatch()  // Start batching signal updates
    rx()          // Execute the user's expression
    endBatch()    // Process all signal updates together
  }
  return callback  // Executed when element is removed
}
```

**Use cases:**
- Clearing intervals/timeouts
- Updating state counters
- Logging removal events
- Cleanup of custom resources

### 2. on Plugin (Event Listeners)

**File:** `library/src/plugins/attributes/on.ts:68-70`

```typescript
target.addEventListener(eventName, callback, evtListOpts)
return () => {
  target.removeEventListener(eventName, callback)
}
```

**Why cleanup is critical:**
- Prevents memory leaks from orphaned event listeners
- Removes listeners from window/document when element is removed
- Ensures proper cleanup of passive, capture, and once listeners

### 3. on-interval Plugin

**File:** `library/src/plugins/attributes/onInterval.ts:32-35`

```typescript
const intervalId = setInterval(callback, duration)
return () => {
  clearInterval(intervalId)
}
```

**Why cleanup is critical:**
- Prevents intervals from continuing to run after element removal
- Avoids attempting to update removed DOM elements
- Prevents memory leaks from accumulating interval callbacks

### 4. effect Plugin

**File:** `library/src/plugins/attributes/effect.ts:14`

```typescript
apply: ({ rx }) => effect(rx)  // effect() returns cleanup function
```

**Why cleanup is critical:**
- Disposes reactive subscriptions to signals
- Prevents effects from running on removed elements
- Stops tracking signal dependencies for removed elements

### 5. on-intersect Plugin

**Pattern:** (Common in intersection observer plugins)

```typescript
const observer = new IntersectionObserver(callback)
observer.observe(el)
return () => {
  observer.disconnect()
}
```

**Why cleanup is critical:**
- Stops observing removed elements
- Prevents observer callbacks from firing on removed elements
- Frees up browser resources

## Edge Cases and Special Behaviors

### Ignored Elements

Elements with `data-ignore` or `data-ignore__self` attributes:
- Are not processed for attributes
- Do not have cleanup functions registered
- Are skipped by the apply logic (`engine.ts:119-120`)

```typescript
const shouldIgnore = (el: HTMLOrSVG) =>
  el.hasAttribute(`${aliasedIgnore}__self`) || !!el.closest(aliasedIgnoreAttr)
```

### Morph-Ignored Elements

Elements with `data-ignore-morph` attribute:
- Are not morphed during DOM updates
- Retain their existing cleanup functions
- Avoid cleanup during morph operations (`morph.ts:18-26`)

### Multiple Cleanups on Same Element

An element can have multiple cleanup functions registered:

```html
<div
  data-on:click="handleClick()"
  data-on-interval="updateCounter()"
  data-effect="logCount()">
</div>
```

This element has three cleanup functions:
1. Remove click event listener
2. Clear interval
3. Dispose effect

When removed, all three execute in iteration order (not guaranteed order).

### Cleanup Execution Order

**Within an element:** Cleanup functions execute in Map iteration order (typically insertion order, but not guaranteed by spec)

**Across elements:** When a parent and children are removed:
1. Parent's cleanup executes
2. Children's cleanup executes (via `querySelectorAll('*')`)
3. No guaranteed order among siblings

### Re-entrant Cleanup

Cleanup functions should be idempotent and safe to call multiple times, though the registry pattern prevents this:

```typescript
if (removals.delete(el)) {  // Returns false if already removed
  // Only executes if element was in registry
}
```

## Best Practices for Plugin Authors

### 1. Always Clean Up Resources

Return a cleanup function when your plugin:
- Adds event listeners
- Creates timers (setTimeout, setInterval, requestAnimationFrame)
- Creates observers (IntersectionObserver, MutationObserver, ResizeObserver)
- Subscribes to external events or streams
- Allocates any other resources that need explicit cleanup

### 2. Make Cleanup Idempotent

Ensure cleanup functions can safely run multiple times:

```typescript
// Good
let intervalId = null
const intervalId = setInterval(callback, 1000)
return () => {
  if (intervalId !== null) {
    clearInterval(intervalId)
    intervalId = null
  }
}

// Also good (clearInterval handles null/undefined)
const intervalId = setInterval(callback, 1000)
return () => clearInterval(intervalId)
```

### 3. Don't Rely on Cleanup Order

Don't assume cleanup functions execute in any particular order, especially across different elements or attributes.

### 4. Handle Signal Updates Carefully

If your cleanup modifies signals, batch the updates:

```typescript
return () => {
  beginBatch()
  // ... modify signals ...
  endBatch()
}
```

### 5. Test Cleanup Paths

Always test:
- Element removal
- Attribute removal
- Attribute value changes
- Parent element removal (to ensure child cleanup)

## Performance Considerations

### MutationObserver Batching

The MutationObserver batches mutations, so multiple rapid removals are processed together efficiently.

### Cleanup Function Overhead

- Cleanup functions are stored in memory for every element with Datastar attributes
- This is generally minimal overhead, but be aware in large DOMs
- The registry is cleaned up when elements are removed

### Pantry Optimization

The pantry mechanism significantly improves performance during morphing by:
- Avoiding unnecessary cleanup/re-initialization cycles
- Preserving element state across moves
- Reducing DOM manipulation

However, it means cleanup doesn't run for moved elements, which is intentional.

## Debugging Cleanup Issues

### Common Problems

1. **Memory leaks from missing cleanup**
   - Symptom: Memory usage grows over time
   - Cause: Intervals, event listeners, or observers not cleaned up
   - Fix: Ensure plugin returns cleanup function

2. **Errors in cleanup functions**
   - Symptom: Console errors when elements are removed
   - Cause: Cleanup function tries to access removed elements
   - Fix: Guard against null/undefined in cleanup

3. **Cleanup not executing**
   - Symptom: Timers continue, listeners fire on removed elements
   - Cause: Plugin doesn't return cleanup function
   - Fix: Return cleanup function from `apply`

4. **Duplicate cleanup execution**
   - Symptom: Cleanup logic runs multiple times
   - Cause: Usually not an issue due to registry pattern, but possible with manual `removeChild` + morph
   - Fix: Make cleanup idempotent

### Debugging Techniques

**Check if cleanup is registered:**
```javascript
// In browser console
const el = document.querySelector('#my-element')
// The removals Map is not exposed, but you can test by removing the element
el.remove()
// Check console for expected cleanup behavior
```

**Monitor MutationObserver:**
Add logging to the `observe` function to see when cleanup is triggered.

**Test attribute removal:**
```javascript
el.removeAttribute('data-on-interval')
// Should execute cleanup for that specific attribute
```

## Summary Table

| Trigger | Cleanup Scope | DOM State | Example |
|---------|--------------|-----------|---------|
| `element.remove()` | Element + all descendants | Element removed | User deletes a component |
| `removeAttribute('data-x')` | Single attribute only | Element remains | Toggling a feature off |
| Attribute value change | Single attribute only | Element remains, value updated | Changing interval duration |
| Parent removed | All descendants | Parent + children removed | Clearing a container |
| Morph (no persistent ID) | Element + descendants | Element replaced | Server updates without ID |
| Morph (persistent ID) | **No cleanup** | Element moved to pantry | Server updates with ID |
| Server patch `mode=remove` | Element + descendants | Element removed | Server-driven deletion |

## API Quick Reference

### Core Functions

| Function | Location | Purpose | Signature |
|----------|----------|---------|-----------|
| `attribute()` | `engine.ts:58` | Register an attribute plugin | `(plugin: AttributePlugin) => void` |
| `apply()` | `engine.ts:184` | Apply plugins to DOM tree | `(root?: HTMLOrSVG \| ShadowRoot) => void` |
| `cleanupEls()` | `engine.ts:104` | Execute cleanup for elements (internal) | `(els: Iterable<HTMLOrSVG>) => void` |

### Core Types

| Type | Location | Description |
|------|----------|-------------|
| `AttributePlugin` | `types.ts:77-86` | Defines an attribute plugin structure |
| `AttributeContext` | `types.ts:66-75` | Context provided to plugin's apply function |
| `HTMLOrSVG` | `types.ts:109` | Union type for HTML/SVG/MathML elements |

### AttributePlugin Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | ✅ | Plugin name (matches `data-{name}`) |
| `apply` | `(ctx: AttributeContext) => void \| (() => void)` | ✅ | Function that sets up the plugin, optionally returns cleanup |
| `requirement` | `Requirement` | ❌ | Defines key/value requirements |
| `returnsValue` | `boolean` | ❌ | Whether the expression returns a value |
| `argNames` | `string[]` | ❌ | Argument names for the expression |

### AttributeContext Properties

| Property | Type | Availability | Description |
|----------|------|--------------|-------------|
| `el` | `HTMLOrSVG` | Always | The element the attribute is on |
| `rawKey` | `string` | Always | Full attribute key with modifiers |
| `mods` | `Map<string, Set<string>>` | Always | Parsed modifiers from attribute |
| `error` | `ErrorFn` | Always | Error helper function |
| `key` | `string \| undefined` | Depends on requirement | The key part (e.g., "click" from "on:click") |
| `value` | `string \| undefined` | Depends on requirement | The attribute value |
| `rx` | `Function \| undefined` | When value exists | Reactive expression executor |
| `evt` | `Event \| undefined` | Event-based plugins | Event object |

### Cleanup Function Contract

| Aspect | Requirement |
|--------|-------------|
| **Signature** | `() => void` |
| **Parameters** | None - use closures to capture state |
| **Return value** | None (void) |
| **Error handling** | Should not throw - catch and log internally |
| **Execution** | Synchronous only |
| **Idempotency** | Should be safe to call multiple times |
| **Side effects** | Clean up resources, optionally update signals |

### Requirement Types

| Value | Key Behavior | Value Behavior |
|-------|-------------|----------------|
| `'allowed'` | Optional | Optional |
| `'must'` | Required | Required |
| `'denied'` | Not allowed | Not allowed |
| `'exclusive'` | One of key or value required (not both) | One of key or value required (not both) |
| `{ key: 'must', value: 'denied' }` | Required | Not allowed |
| `{ key: 'denied', value: 'must' }` | Not allowed | Required |

### Common Cleanup Patterns

| Resource Type | Setup Pattern | Cleanup Pattern |
|---------------|---------------|-----------------|
| **Event Listener** | `target.addEventListener(evt, cb)` | `target.removeEventListener(evt, cb)` |
| **Interval** | `const id = setInterval(fn, ms)` | `clearInterval(id)` |
| **Timeout** | `const id = setTimeout(fn, ms)` | `clearTimeout(id)` |
| **Animation Frame** | `const id = requestAnimationFrame(fn)` | `cancelAnimationFrame(id)` |
| **IntersectionObserver** | `obs.observe(el)` | `obs.disconnect()` |
| **MutationObserver** | `obs.observe(target, opts)` | `obs.disconnect()` |
| **ResizeObserver** | `obs.observe(el)` | `obs.disconnect()` |
| **Reactive Effect** | `effect(fn)` | `dispose()` (returned function) |
| **Subscription** | `source.subscribe(cb)` | `unsubscribe()` or `subscription.unsubscribe()` |

### Signal Batching Functions

| Function | Location | Purpose |
|----------|----------|---------|
| `beginBatch()` | `signals.ts` | Start batching signal updates |
| `endBatch()` | `signals.ts` | Process all batched signal updates |

**Usage in cleanup:**
```typescript
return () => {
  beginBatch()
  // ... update signals ...
  endBatch()
}
```

### Cleanup Triggers Reference

| Trigger | Function | Cleanup Scope |
|---------|----------|---------------|
| Element removed from DOM | `element.remove()` | Element + descendants |
| Parent element removed | `parent.remove()` | Parent + all descendants |
| Attribute removed | `element.removeAttribute('data-x')` | Single attribute only |
| Attribute value changed | `element.setAttribute('data-x', 'new')` | Old cleanup, then new apply |
| Server patch remove | `mode=remove` | Targeted elements + descendants |
| Morph (non-persistent) | DOM replaced | Removed elements + descendants |
| Morph (persistent ID) | Element moved | **No cleanup** |

### File Locations

| Component | File | Line |
|-----------|------|------|
| Cleanup registry | `library/src/engine/engine.ts` | 54 |
| Cleanup execution | `library/src/engine/engine.ts` | 104-115 |
| Cleanup registration | `library/src/engine/engine.ts` | 281-291 |
| MutationObserver | `library/src/engine/engine.ts` | 137-179 |
| Attribute plugin type | `library/src/engine/types.ts` | 77-86 |
| Morph removeNode | `library/src/engine/morph.ts` | 271-278 |

## Conclusion

The Datastar cleanup mechanism provides a robust, automatic way to manage resource cleanup when DOM elements or attributes are removed. By understanding the various triggers and behaviors, plugin authors can create reliable, leak-free components, and application developers can reason about when cleanup occurs in their applications.

### Key Takeaways

**API Usage:**
- 🔧 Use `attribute()` to register plugins that return cleanup functions
- 🔧 Access element and state via `AttributeContext` in `apply()`
- 🔧 Return `() => void` from `apply()` for automatic cleanup
- 🔧 Capture state via closures in the cleanup function

**Cleanup Execution:**
- ✅ Cleanup executes on element removal (and all descendants)
- ✅ Cleanup executes on attribute removal (specific attribute only)
- ✅ Cleanup executes before attribute re-application
- ❌ Cleanup does NOT execute when elements are moved to the pantry (persistent ID optimization)

**Best Practices:**
- 🔧 Always return cleanup functions from plugins that allocate resources
- 🔧 Make cleanup functions idempotent and safe
- 🔧 Never throw errors in cleanup functions
- 🔧 Batch signal updates with `beginBatch()` / `endBatch()`
- 🔧 Use closures to capture state, not global variables
- 🔧 Test all cleanup paths: element removal, attribute removal, and value changes
