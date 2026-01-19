'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@/lib/use-wallet';
import RegistrationModal from './ui/RegistrationModal';

export default function UserRegistrationManager() {
    const { address, isConnected } = useWallet();
    const [showModal, setShowModal] = useState(false);
    const [hasChecked, setHasChecked] = useState(false);

    useEffect(() => {
        const checkUserStatus = async () => {
            if (!isConnected || !address) {
                setShowModal(false);
                return;
            }

            try {
                // Prevent caching to ensure we get fresh data
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/user/${address}`, {
                    cache: 'no-store',
                    headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
                });
                const data = await res.json();
                console.log('👤 User Status Check:', { address, found: !!data.user, displayName: data.user?.display_name });

                if (data.success) {
                    // If user is null or doesn't have display_name (legacy users), show modal
                    if (!data.user || !data.user.display_name) {
                        setShowModal(true);
                    } else {
                        setShowModal(false);
                    }
                }
            } catch (error) {
                console.error('Failed to check user status:', error);
            } finally {
                setHasChecked(true);
            }
        };

        if (isConnected && address) {
            checkUserStatus();
        }
    }, [isConnected, address]);

    const handleRegisterSuccess = () => {
        setShowModal(false);
        // Optionally trigger a refresh or context update
        console.log('User registered successfully');
    };

    if (!isConnected) return null;

    return (
        <RegistrationModal
            isOpen={showModal}
            onRegister={handleRegisterSuccess}
        />
    );
}
