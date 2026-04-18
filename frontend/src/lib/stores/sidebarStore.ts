import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface SidebarState {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  toggleCollapsed: () => void;
  setCollapsed: (value: boolean) => void;
  openMobile: () => void;
  closeMobile: () => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      isCollapsed: false,
      isMobileOpen: false,
      toggleCollapsed: () => set((s) => ({ isCollapsed: !s.isCollapsed })),
      setCollapsed: (value) => set({ isCollapsed: value }),
      openMobile: () => set({ isMobileOpen: true }),
      closeMobile: () => set({ isMobileOpen: false }),
    }),
    {
      name: 'sidebar:collapsed',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ isCollapsed: state.isCollapsed }),
    }
  )
);
