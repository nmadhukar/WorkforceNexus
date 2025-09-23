/**
 * @fileoverview Toast notification system for user feedback
 * 
 * This module provides a comprehensive toast notification system built on top of
 * Radix UI's toast primitive. It manages toast state, lifecycle, and provides
 * both imperative and hook-based APIs for showing notifications.
 * 
 * Features:
 * - Global toast state management
 * - Auto-dismiss with configurable delay
 * - Support for multiple toast variants (default, destructive, success)
 * - Action buttons in toasts
 * - Queue management with limit
 * - Imperative API for one-off toasts
 * - Hook API for component-based usage
 * 
 * @module use-toast
 */

import * as React from "react"

import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

/** Maximum number of toasts that can be displayed simultaneously */
const TOAST_LIMIT = 1
/** Delay in milliseconds before a toast is automatically removed */
const TOAST_REMOVE_DELAY = 1000000

/**
 * Enhanced toast type with additional properties for the toast system
 * @typedef {Object} ToasterToast
 * @extends ToastProps
 */
type ToasterToast = ToastProps & {
  /** Unique identifier for the toast */
  id: string
  /** Toast title content */
  title?: React.ReactNode
  /** Toast description content */
  description?: React.ReactNode
  /** Optional action button element */
  action?: ToastActionElement
}

/** Action types for toast state management */
const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

/** Internal counter for generating unique toast IDs */
let count = 0

/**
 * Generates unique ID for toast instances
 * @returns {string} Unique string identifier
 * @description Uses an incrementing counter that wraps at MAX_SAFE_INTEGER
 */
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

/** Type for action type constants */
type ActionType = typeof actionTypes

/**
 * Union type for all possible toast actions
 * @typedef {Object} Action
 */
type Action =
  | {
      /** Action to add a new toast to the queue */
      type: ActionType["ADD_TOAST"]
      /** Complete toast data */
      toast: ToasterToast
    }
  | {
      /** Action to update an existing toast */
      type: ActionType["UPDATE_TOAST"]
      /** Partial toast data to merge */
      toast: Partial<ToasterToast>
    }
  | {
      /** Action to dismiss a toast (start removal process) */
      type: ActionType["DISMISS_TOAST"]
      /** Optional ID of specific toast to dismiss */
      toastId?: ToasterToast["id"]
    }
  | {
      /** Action to completely remove a toast from state */
      type: ActionType["REMOVE_TOAST"]
      /** Optional ID of specific toast to remove */
      toastId?: ToasterToast["id"]
    }

/**
 * Toast state interface
 * @interface State
 */
interface State {
  /** Array of active toast notifications */
  toasts: ToasterToast[]
}

/** Map to track auto-removal timeouts for each toast */
const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * Schedules a toast for automatic removal after the configured delay
 * 
 * @param {string} toastId - ID of the toast to schedule for removal
 * @description
 * Prevents duplicate timeouts for the same toast and manages the removal queue.
 * Uses the global TOAST_REMOVE_DELAY to determine when to remove the toast.
 */
const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

/**
 * Toast state reducer for managing toast lifecycle
 * 
 * @param {State} state - Current toast state
 * @param {Action} action - Action to perform on the state
 * @returns {State} New state after applying the action
 * 
 * @description
 * Handles all toast state transitions including adding, updating, dismissing,
 * and removing toasts. Enforces the TOAST_LIMIT and manages toast queue.
 */
export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id)
        })
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      }
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

/** Array of listeners subscribed to toast state changes */
const listeners: Array<(state: State) => void> = []

/** Global memory state for toast notifications */
let memoryState: State = { toasts: [] }

/**
 * Dispatches an action to update toast state and notify all listeners
 * 
 * @param {Action} action - The action to dispatch
 * @description
 * Updates the global memory state using the reducer and notifies all
 * subscribed listeners of the state change.
 */
function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

/** Toast properties without the auto-generated ID */
type Toast = Omit<ToasterToast, "id">

/**
 * Creates and displays a new toast notification
 * 
 * @param {Toast} props - Toast configuration object
 * @param {React.ReactNode} [props.title] - Toast title content
 * @param {React.ReactNode} [props.description] - Toast description content
 * @param {ToastActionElement} [props.action] - Optional action button
 * @param {string} [props.variant] - Toast variant (default, destructive, success)
 * @returns {Object} Toast control object
 * @returns {string} returns.id - Unique toast identifier
 * @returns {Function} returns.dismiss - Function to dismiss the toast
 * @returns {Function} returns.update - Function to update toast properties
 * 
 * @description
 * Imperative API for creating toast notifications. The toast is automatically
 * added to the global state and will be displayed by the Toaster component.
 * 
 * @example
 * ```tsx
 * // Simple success message
 * toast({
 *   title: "Success!",
 *   description: "Your changes have been saved.",
 *   variant: "default"
 * });
 * ```
 * 
 * @example
 * ```tsx
 * // Error message with action
 * toast({
 *   title: "Error",
 *   description: "Failed to save changes.",
 *   variant: "destructive",
 *   action: <ToastAction altText="Retry">Retry</ToastAction>
 * });
 * ```
 */
function toast({ ...props }: Toast) {
  const id = genId()

  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    })
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  return {
    id: id,
    dismiss,
    update,
  }
}

/**
 * React hook for accessing toast state and functions
 * 
 * @hook
 * @returns {Object} Toast state and control functions
 * @returns {ToasterToast[]} returns.toasts - Array of active toasts
 * @returns {Function} returns.toast - Function to create new toasts
 * @returns {Function} returns.dismiss - Function to dismiss toasts
 * 
 * @description
 * Provides access to the global toast state and functions for managing toasts.
 * Components using this hook will re-render when toast state changes.
 * Automatically manages listener subscription and cleanup.
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { toast, dismiss } = useToast();
 *   
 *   const showSuccess = () => {
 *     toast({
 *       title: "Success!",
 *       description: "Operation completed successfully."
 *     });
 *   };
 *   
 *   return (
 *     <button onClick={showSuccess}>Show Toast</button>
 *   );
 * }
 * ```
 * 
 * @example
 * ```tsx
 * function ToastList() {
 *   const { toasts, dismiss } = useToast();
 *   
 *   return (
 *     <div>
 *       {toasts.map(toast => (
 *         <div key={toast.id}>
 *           {toast.title}
 *           <button onClick={() => dismiss(toast.id)}>X</button>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  }
}

export { useToast, toast }
