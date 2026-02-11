const https = require('https');

const adminSecret = process.env.ADMIN_SECRET || 'oppol-admin-2026';

const postData = JSON.stringify({
    marketId: 4,
    volume: "1.04742"
});

const options = {
    hostname: 'oppol-dug5.onrender.com',
    port: 443,
    path: '/api/admin/set-volume',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': adminSecret,
        'Content-Length': postData.length
    }
};

console.log('Setting Market 4 volume to $1.04742...\n');

const req = https.request(options, (res) => {
    let data = '';

    console.log(`Status: ${res.statusCode}`);

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log('\n=== RESPONSE ===');
            console.log(JSON.stringify(json, null, 2));
        } catch (e) {
            console.log('\n=== RAW RESPONSE ===');
            console.log(data);
        }
    });
});

req.on('error', (error) => {
    console.error('Error:', error.message);
});

req.write(postData);
req.end();
