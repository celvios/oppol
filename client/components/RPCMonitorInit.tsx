'use client';

import { useEffect } from 'react';

export function RPCMonitorInit() {
    useEffect(() => {
        // Dynamically import the monitor only on client side
        import('@/lib/rpc-monitor').then(() => {
            console.log('🔍 RPC Monitor loaded and active');
        });
    }, []);

    return null; // This component renders nothing
}
