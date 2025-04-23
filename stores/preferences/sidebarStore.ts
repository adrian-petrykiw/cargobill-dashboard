// @/store/preferences/sidebarStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SidebarMode = 'expanded' | 'collapsed' | 'hover';

interface SidebarState {
  mode: SidebarMode;
  setMode: (mode: SidebarMode) => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      mode: 'hover',
      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'sidebar-storage',
    },
  ),
);
