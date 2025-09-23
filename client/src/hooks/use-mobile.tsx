/**
 * @fileoverview Mobile device detection hook for responsive design
 * 
 * This module provides a React hook for detecting whether the current device
 * should be considered mobile based on screen width. It uses the window.matchMedia
 * API for efficient responsive design detection.
 * 
 * @module use-mobile
 */

import * as React from "react"

/** Breakpoint width in pixels that defines the mobile/desktop boundary */
const MOBILE_BREAKPOINT = 768

/**
 * Custom hook for detecting mobile device based on screen width
 * 
 * @hook
 * @returns {boolean} True if the current viewport width is below the mobile breakpoint (768px)
 * 
 * @description
 * Uses window.matchMedia API to efficiently detect viewport changes and determine
 * if the current device should be treated as mobile. The hook subscribes to media
 * query changes for real-time updates when the window is resized.
 * 
 * Features:
 * - Real-time updates on window resize
 * - Efficient using matchMedia API
 * - SSR-safe with undefined initial state
 * - Automatic cleanup of event listeners
 * 
 * @example
 * ```tsx
 * function ResponsiveComponent() {
 *   const isMobile = useIsMobile();
 *   
 *   return (
 *     <div className={isMobile ? "mobile-layout" : "desktop-layout"}>
 *       {isMobile ? <MobileNav /> : <DesktopNav />}
 *     </div>
 *   );
 * }
 * ```
 * 
 * @example
 * ```tsx
 * function ConditionalRender() {
 *   const isMobile = useIsMobile();
 *   
 *   if (isMobile) {
 *     return <MobileOnlyFeature />;
 *   }
 *   
 *   return <DesktopFeature />;
 * }
 * ```
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
