'use client';

import { useEffect } from 'react';

export function RPCMonitorInit() {
    useEffect(() => {
        // Only run in development
        if (process.env.NODE_ENV === 'development') {
            // Dynamically import the monitor only on client side
            import('@/lib/rpc-monitor').then(() => {
                console.log('🔍 RPC Monitor loaded and active (DEV ONLY)');
            });
        }
    }, []);

    return null; // This component renders nothing
}
