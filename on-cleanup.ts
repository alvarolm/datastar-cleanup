/**
 * On-Cleanup Plugin for Datastar
 *
 * Executes expressions when cleanup is triggered. Cleanup occurs when:
 * - Elements are removed from the DOM (element.remove(), parent removal, etc.)
 * - The data-on-cleanup attribute is removed from an element
 * - The data-on-cleanup attribute value is changed
 * - Elements are removed during DOM morphing operations
 * - Server sends patch-elements with mode=remove
 *
 * Perfect for cleanup tasks, logging, and state management.
 *
 * Setup:
 *   import * as datastar from './datastar.js'
 *   import { install } from './on-cleanup.js'
 *   install(datastar)
 *
 * Examples:
 *   <!-- Basic cleanup -->
 *   <div data-on-cleanup="console.log('Cleanup executed')">
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
 *   <!-- Update state on cleanup -->
 *   <div data-on-cleanup="$count--; $logs.push('Item cleaned up')">
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
      // Datastar will execute this when cleanup is triggered (see file header for details)
      return callback
    },
  })

  console.log('[datastar-on-cleanup] Plugin registered')
}
