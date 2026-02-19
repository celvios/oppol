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

    // Existing check logic for Reown users ...
    useEffect(() => {
        const checkUserStatus = async () => {
            if (!isConnected || !walletAddress) {
                setShowModal(false);
                return;
            }

            // Don't check again if user was already registered in this session
            if (hasRegisteredRef.current) {
                return;
            }

            // Check localStorage first to avoid unnecessary API calls
            const safeAddress = (walletAddress || "").toLowerCase();
            const storageKey = `user_registered_${safeAddress}`;
            const wasRegistered = localStorage.getItem(storageKey);

            // If already registered via Privy sync, skip check
            if (isRegistered) return;

            if (wasRegistered === 'true') {
                // Still verify with API to ensure user actually exists
                try {
                    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/user/${walletAddress}`);
                    const data = await res.json();
                    if (data.success && data.user && data.user.display_name) {
                        setIsRegistered(true);
                        setShowModal(false);
                        return;
                    } else {
                        // User was marked as registered but doesn't have display_name - clear localStorage
                        localStorage.removeItem(storageKey);
                    }
                } catch (error) {
                    // If API fails but localStorage says registered, trust localStorage
                    setIsRegistered(true);
                    setShowModal(false);
                    return;
                }
            }

            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/user/${walletAddress}`);
                const data = await res.json();

                if (data.success) {
                    // If user exists and has display_name, mark as registered
                    if (data.user && data.user.display_name) {
                        setIsRegistered(true);
                        setShowModal(false);
                        localStorage.setItem(storageKey, 'true');
                    } else {
                        // User doesn't exist or doesn't have display_name - show modal
                        setShowModal(true);
                    }
                } else {
                    // API returned error - don't block user, but show modal
                    setShowModal(true);
                }
            } catch (error) {
                console.error('Failed to check user status:', error);
                // On error, check localStorage as fallback
                const storageKey = `user_registered_${walletAddress.toLowerCase()}`;
                const wasRegistered = localStorage.getItem(storageKey);
                if (wasRegistered === 'true') {
                    setIsRegistered(true);
                    setShowModal(false);
                } else {
                    // Show modal if we can't verify
                    setShowModal(true);
                }
            } finally {
                setHasChecked(true);
            }
        };

        if (isConnected && walletAddress) {
            checkUserStatus();
        }
    }, [isConnected, walletAddress, isRegistered]);

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
