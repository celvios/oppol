import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
    id: string;
    display_name: string;
    avatar_url?: string;
    wallet_address: string; // This is the MAIN address (Custodial if applicable)
    privy_user_id?: string;
    is_custodial?: boolean;
}

interface UIState {
    isTradeModalOpen: boolean;
    setTradeModalOpen: (isOpen: boolean) => void;
    isInputFocused: boolean;
    setInputFocused: (isFocused: boolean) => void;
    isCommentsOpen: boolean;
    setCommentsOpen: (isOpen: boolean) => void;
    isLoginModalOpen: boolean;
    setLoginModalOpen: (isOpen: boolean) => void;

    // User Session
    user: User | null;
    setUser: (user: User | null) => void;
    custodialAddress: string | null;
    setCustodialAddress: (address: string | null) => void;
}

export const useUIStore = create<UIState>()(
    persist(
        (set) => ({
            isTradeModalOpen: false,
            setTradeModalOpen: (isOpen) => set({ isTradeModalOpen: isOpen }),
            isInputFocused: false,
            setInputFocused: (isFocused) => set({ isInputFocused: isFocused }),
            isCommentsOpen: false,
            setCommentsOpen: (isOpen) => set({ isCommentsOpen: isOpen }),
            isLoginModalOpen: false,
            setLoginModalOpen: (isOpen) => set({ isLoginModalOpen: isOpen }),

            user: null,
            setUser: (user) => set({ user }),
            custodialAddress: null,
            setCustodialAddress: (address) => set({ custodialAddress: address }),
        }),
        {
            name: 'opoll-ui-storage', // name of the item in the storage (must be unique)
            partialize: (state) => ({
                user: state.user,
                custodialAddress: state.custodialAddress
            }), // Only persist user data
        }
    )
);

