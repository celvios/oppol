'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import RegistrationModal from './ui/RegistrationModal';
import { useUIStore } from '@/lib/store';

export default function UserRegistrationManager() {
    const { isAuthenticated: isConnected, walletAddress, user, loginMethod } = useAuth();
    const [showModal, setShowModal] = useState(false);
    const [hasChecked, setHasChecked] = useState(false);
    const [isRegistered, setIsRegistered] = useState(false);
    const hasRegisteredRef = useRef(false);

    // Store access
    const { setUser, setCustodialAddress } = useUIStore();

    // Sync Privy User with Backend
    useEffect(() => {
        const syncPrivyUser = async () => {
            // Check if we have a valid Privy user (id present) and a wallet address
            // We accept any login method that provides a Privy User object (Google, Email, Twitter, etc.)
            const isValidPrivySession = user && user.id && walletAddress;

            // Exclude pure wallet connection if they don't have a Privy ID (useAuth returns user=null for pure Wagmi)
            // But if they logged in via Privy Wallet, user is not null.

            if (isValidPrivySession) {
                try {
                    console.log('Syncing Privy user with backend...', {
                        privyId: user.id,
                        method: loginMethod,
                        address: walletAddress
                    });

                    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/auth/privy`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            privyUserId: user.id,
                            email: user.email?.address,
                            walletAddress: walletAddress,
                            loginMethod: loginMethod // Pass login method to trigger custodial wallet creation for social logins
                        })
                    });

                    const data = await res.json();
                    if (data.success) {
                        console.log('✅ Privy user synced successfully:', data.user);
                        setIsRegistered(true);

                        // SYNC TO STORE
                        setUser(data.user);
                        if (data.custodialAddress) {
                            console.log('Using Custodial Address:', data.custodialAddress);
                            setCustodialAddress(data.custodialAddress);
                        } else {
                            setCustodialAddress(null);
                        }

                        localStorage.setItem(`user_registered_${walletAddress.toLowerCase()}`, 'true');
                    } else {
                        console.warn('Sync response not success:', data);
                    }
                } catch (error) {
                    console.error('Failed to sync Privy user:', error);
                }
            }
        };

        if (isConnected && user) {
            syncPrivyUser();
        }
    }, [isConnected, loginMethod, user, walletAddress, setUser, setCustodialAddress]);

    // Check registration status for wallet users
    // NOTE: Social/Privy users are handled by the syncPrivyUser effect above.
    // This effect only shows the modal for wallet users who haven't registered.
    useEffect(() => {
        const checkUserStatus = async () => {
            if (!isConnected || !walletAddress) {
                setShowModal(false);
                return;
            }

            // Use ref as the primary session guard — avoids re-trigger loop
            if (hasRegisteredRef.current) {
                return;
            }

            // Social/Privy users are automatically synced — never show modal for them
            // loginMethod is 'google' | 'email' | 'twitter' | 'discord' | 'privy'
            if (loginMethod && loginMethod !== 'wallet') {
                hasRegisteredRef.current = true;
                setShowModal(false);
                return;
            }

            const safeAddress = walletAddress.toLowerCase();
            const storageKey = `user_registered_${safeAddress}`;

            // Trust localStorage cache first
            const wasRegistered = localStorage.getItem(storageKey);
            if (wasRegistered === 'true') {
                hasRegisteredRef.current = true;
                setIsRegistered(true);
                setShowModal(false);
                return;
            }

            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/user/${walletAddress}`);
                const data = await res.json();

                if (data.success && data.user) {
                    // User exists in DB — consider them registered regardless of display_name
                    hasRegisteredRef.current = true;
                    setIsRegistered(true);
                    setShowModal(false);
                    localStorage.setItem(storageKey, 'true');
                } else {
                    // Truly new wallet user — show modal
                    setShowModal(true);
                }
            } catch (error) {
                console.error('Failed to check user status:', error);
                // On network error, don't block the user — trust localStorage
                setShowModal(false);
            } finally {
                setHasChecked(true);
            }
        };

        if (isConnected && walletAddress) {
            checkUserStatus();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isConnected, walletAddress, loginMethod]); // intentionally exclude isRegistered to avoid loop

    const handleRegisterSuccess = async () => {
        setShowModal(false);
        hasRegisteredRef.current = true;
        setIsRegistered(true);

        // Mark as registered in localStorage
        if (walletAddress) {
            const safeAddress = (walletAddress || "").toLowerCase();
            const storageKey = `user_registered_${safeAddress}`;
            localStorage.setItem(storageKey, 'true');
        }

        // Verify registration was successful
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/user/${walletAddress}`);
            const data = await res.json();
            if (data.success && data.user && data.user.display_name) {
                console.log('User registered successfully:', data.user.display_name);
            }
        } catch (error) {
            console.error('Failed to verify registration:', error);
        }
    };

    if (!isConnected) return null;

    return (
        <RegistrationModal
            isOpen={showModal}
            onRegister={handleRegisterSuccess}
        />
    );
}
