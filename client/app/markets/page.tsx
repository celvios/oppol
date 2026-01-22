import { getMarketsServer } from "@/lib/server-fetch";
import { MarketsClient } from "./MarketsClient";

// SERVER COMPONENT - data fetched on server = instant load!
export default async function MarketsPage() {
    const markets = await getMarketsServer();
    
    return <MarketsClient initialMarkets={markets} />;
}
