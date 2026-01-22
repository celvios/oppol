/**
 * Server-side market fetching for SSR/SSG
 * This runs on the server, so data is embedded in HTML - no client loading!
 */

export interface ServerMarket {
    id: number;
    market_id: number;
    question: string;
    image_url: string;
    description: string;
    category_id: string;
    outcomes: string[];
    outcomeCount: number;
    prices: number[];
    endTime: number;
    liquidityParam: string;
    totalVolume: string;
    resolved: boolean;
    winningOutcome: number;
}

/**
 * Fetch markets on the server (for SSR)
 * Called in Server Components or getServerSideProps
 */
export async function getMarketsServer(): Promise<ServerMarket[]> {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    
    if (!apiUrl) {
        console.error('[Server] NEXT_PUBLIC_API_URL not set');
        return [];
    }

    try {
        const response = await fetch(`${apiUrl}/api/markets`, {
            next: { revalidate: 30 } // Cache for 30 seconds on server
        });

        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.success || !data.markets) {
            return [];
        }

        return data.markets.map((m: any) => ({
            id: m.market_id ?? m.id,
            market_id: m.market_id ?? m.id,
            question: m.question,
            image_url: m.image_url || '',
            description: m.description || '',
            category_id: m.category_id || '',
            outcomes: m.outcomes || [],
            outcomeCount: m.outcomeCount || m.outcomes?.length || 2,
            prices: m.prices || [],
            endTime: m.endTime,
            liquidityParam: m.liquidityParam || '0',
            totalVolume: m.totalVolume || '0',
            resolved: m.resolved || false,
            winningOutcome: m.winningOutcome || 0,
        }));
    } catch (error) {
        console.error('[Server] Failed to fetch markets:', error);
        return [];
    }
}

