const http = require('http');

const PORT = 3000; // Try 3000 first as per logs
const MARKET_ID = 0; // Check market 0
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin123';

function checkMarket(port) {
    const options = {
        hostname: 'localhost',
        port: port,
        path: `/api/admin/debug-market/${MARKET_ID}`,
        method: 'GET',
        headers: {
            'x-admin-secret': ADMIN_SECRET
        }
    };

    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        res.on('end', () => {
            console.log(`Port ${port} Response: ${res.statusCode}`);
            if (res.statusCode === 200) {
                try {
                    const json = JSON.parse(data);
                    console.log(JSON.stringify(json, null, 2));
                } catch (e) {
                    console.log("Response body:", data);
                }
            } else {
                console.log("Error body:", data);
            }
        });
    });

    req.on('error', (error) => {
        console.error(`Error on port ${port}:`, error.message);
    });

    req.end();
}

console.log("Checking debug endpoint...");
checkMarket(3000);
checkMarket(3001);
