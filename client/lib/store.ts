import { create } from 'zustand';

interface UIState {
    isTradeModalOpen: boolean;
    setTradeModalOpen: (isOpen: boolean) => void;
    isInputFocused: boolean;
    setInputFocused: (isFocused: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
    isTradeModalOpen: false,
    setTradeModalOpen: (isOpen) => set({ isTradeModalOpen: isOpen }),
    isInputFocused: false,
    setInputFocused: (isFocused) => set({ isInputFocused: isFocused }),
}));
