
import axios from 'axios';

async function main() {
    try {
        console.log('Fetching from Local API...');
        const res = await axios.get('http://localhost:3001/api/markets');
        console.log(`API returned ${res.data.markets.length} markets.`);
        res.data.markets.forEach((m: any) => {
            console.log(`[${m.market_id}] ${m.question}`);
        });
    } catch (e) {
        console.error('Error fetching API:', e);
    }
}

main();
