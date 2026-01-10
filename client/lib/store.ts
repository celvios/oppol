import { create } from 'zustand';

interface UIState {
    isTradeModalOpen: boolean;
    setTradeModalOpen: (isOpen: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
    isTradeModalOpen: false,
    setTradeModalOpen: (isOpen) => set({ isTradeModalOpen: isOpen }),
}));
