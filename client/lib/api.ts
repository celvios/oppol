const API_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) {
    console.warn('NEXT_PUBLIC_API_URL is not defined in environment variables');
}

type ApiOptions = RequestInit & {
    token?: string;
};

export async function apiRequest<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
    const { token, headers, ...customConfig } = options;

    const config: RequestInit = {
        ...customConfig,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...headers,
        },
    };

    const response = await fetch(`${API_URL}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
    }

    return data;
}

export const authApi = {
    verify: (token: string) => apiRequest<{ success: boolean; token: string }>('/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ token }),
    }),
};

export const walletApi = {
    get: (userId: string, token: string) => apiRequest<any>(`/wallet/${userId}`, { token }),
};
