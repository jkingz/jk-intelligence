import * as React from "react"

const MOBILE_BREAKPOINT = 768

/**
 * Same false-during-hydration / correct-after timing the generated version had, expressed as
 * a store subscription because `setIsMobile` in the effect body fails react-hooks/set-state-in-effect.
 */
function subscribe(onStoreChange: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", onStoreChange)
  return () => mql.removeEventListener("change", onStoreChange)
}

function getSnapshot() {
  return window.innerWidth < MOBILE_BREAKPOINT
}

function getServerSnapshot() {
  return false
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
