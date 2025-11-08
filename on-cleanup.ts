/**
 * On-Cleanup Plugin for Datastar
 *
 * Executes expressions when elements are removed from the DOM.
 * Perfect for cleanup tasks, logging, and state management.
 *
 * Setup:
 *   import * as datastar from './datastar.js'
 *   import { install } from './on-cleanup.js'
 *   install(datastar)
 *
 * Examples:
 *   <!-- Basic cleanup -->
 *   <div data-on-cleanup="console.log('Element removed')">
 *     Content
 *   </div>
 *
 *   <!-- Timer cleanup -->
 *   <div
 *     data-init="$timer = setInterval(() => $count++, 1000)"
 *     data-on-cleanup="clearInterval($timer)">
 *     Timer: <span data-text="$count"></span>
 *   </div>
 *
 *   <!-- Update state on removal -->
 *   <div data-on-cleanup="$count--; $logs.push('Item removed')">
 *     Removable item
 *   </div>
 */

import { attribute } from '@engine'
import { beginBatch, endBatch } from '@engine/signals'

// Create a type-only definition for the engine parameter
type DatastarEngine = {
  attribute: typeof attribute
  beginBatch: typeof beginBatch
  endBatch: typeof endBatch
}

/**
 * Install the on-cleanup plugin
 */
export function install(engine: DatastarEngine): void {
  const { attribute, beginBatch, endBatch } = engine

  attribute({
    name: 'on-cleanup',

    requirement: {
      key: 'denied',  // No key allowed (e.g., data-on-cleanup:click is invalid)
      value: 'must'   // Value is required (the expression to execute)
    },

    apply({ rx }) {
      // Create the callback that will execute when element is removed
      const callback = () => {
        beginBatch()  // Start batching signal updates
        rx()          // Execute the user's expression
        endBatch()    // Process all signal updates together
      }

      // Return the callback as a cleanup function
      // Datastar will execute this when the element is removed from the DOM
      return callback
    },
  })

  console.log('[datastar-on-cleanup] Plugin registered')
}
