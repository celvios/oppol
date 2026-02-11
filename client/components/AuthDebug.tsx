'use client';

import { useEffect } from 'react';

export default function AuthDebug() {
    useEffect(() => {
        console.log('🔍 [AUTH DEBUG] Component Mounted');

        // Check if /api/test_route works (Router Health)
        fetch('/api/test_route')
            .then(res => res.json())
            .then(data => console.log('✅ [AUTH DEBUG] Router Health:', data))
            .catch(err => console.error('❌ [AUTH DEBUG] Router Health Failed:', err));

        // Check NextAuth Configuration (Session)
        fetch('/api/auth/session')
            .then(async res => {
                console.log('🔍 [AUTH DEBUG] Session Endpoint Status:', res.status);
                if (res.status === 200) {
                    const data = await res.json();
                    console.log('✅ [AUTH DEBUG] Session Data:', data);
                } else {
                    const text = await res.text();
                    console.error('❌ [AUTH DEBUG] Session Error Body:', text);
                }
            })
            .catch(err => console.error('❌ [AUTH DEBUG] Session Fetch Failed:', err));

        // Check Providers
        fetch('/api/auth/providers')
            .then(res => res.json())
            .then(data => console.log('🔍 [AUTH DEBUG] Configured Providers:', data))
            .catch(err => console.error('❌ [AUTH DEBUG] Providers Check Failed:', err));

    }, []);

    return null;
}
