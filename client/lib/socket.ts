'use client';

import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
    if (!socket) {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        socket = io(apiUrl, {
            transports: ['websocket'], // WebSocket only, no polling fallback
            autoConnect: true,
        });

        socket.on('connect', () => {
            console.log('✅ WebSocket connected:', socket?.id);
        });

        socket.on('disconnect', () => {
            console.log('❌ WebSocket disconnected');
        });

        socket.on('connect_error', (error) => {
            console.error('❌ WebSocket connection error:', error);
        });
    }

    return socket;
};

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};
