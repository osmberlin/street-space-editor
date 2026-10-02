import type { LocationOpenerId } from '@osm-editor-kit/street-imagery'
import { create } from 'zustand'

/**
 * "Pick a place on the map" for a location opener: a button arms it, the next map click opens
 * the place (`LocationPickOnMap`) and disarms. The host shows the armed state (pressed button,
 * crosshair cursor, a hint on the map).
 */
type LocationPickStore = {
  armedOpenerId: LocationOpenerId | null
  actions: {
    arm: (openerId: LocationOpenerId) => void
    disarm: () => void
    /** Arm, or disarm when this opener is armed already. */
    toggle: (openerId: LocationOpenerId) => void
  }
}

const useLocationPickStore = create<LocationPickStore>()((set) => ({
  armedOpenerId: null,
  actions: {
    arm: (openerId) => set({ armedOpenerId: openerId }),
    disarm: () => set((state) => (state.armedOpenerId == null ? state : { armedOpenerId: null })),
    toggle: (openerId) =>
      set((state) => ({ armedOpenerId: state.armedOpenerId === openerId ? null : openerId })),
  },
}))

/** The opener waiting for a map click, or `null`. */
export const useArmedLocationOpenerId = () => useLocationPickStore((state) => state.armedOpenerId)

export const useLocationPickActions = () => useLocationPickStore((state) => state.actions)
