/**
 * @fileoverview Utility Functions for the HR Management System
 * 
 * This module provides commonly used utility functions throughout the application.
 * Currently focused on CSS class name manipulation for Tailwind CSS.
 * 
 * @module utils
 */

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merge and deduplicate CSS class names
 * 
 * @function cn
 * @param {...ClassValue} inputs - Variable number of class values to merge
 * @returns {string} Merged and deduplicated class string
 * 
 * @description
 * Combines multiple class names, conditionally includes classes, and intelligently
 * merges Tailwind CSS classes to avoid conflicts. This is essential for component
 * composition and conditional styling.
 * 
 * Features:
 * - Handles string, object, and array inputs via clsx
 * - Deduplicates Tailwind utility classes via tailwind-merge
 * - Resolves conflicts (e.g., 'p-2 p-4' becomes 'p-4')
 * - Supports conditional classes
 * 
 * @example
 * // Simple concatenation
 * cn('text-red-500', 'font-bold')
 * // Returns: 'text-red-500 font-bold'
 * 
 * @example
 * // Conditional classes
 * cn('base-class', {
 *   'active-class': isActive,
 *   'disabled-class': isDisabled
 * })
 * 
 * @example
 * // Overriding Tailwind classes
 * cn('p-2 text-sm', 'p-4') // Returns: 'text-sm p-4'
 * 
 * @example
 * // Component composition
 * <Button className={cn(
 *   'base-button-styles',
 *   variant === 'primary' && 'bg-blue-500',
 *   size === 'large' && 'text-lg p-4',
 *   className // Allow parent to override
 * )} />
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
