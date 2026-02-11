const https = require('https');

const adminSecret = process.env.ADMIN_SECRET || 'oppol-admin-2026';

const postData = JSON.stringify({});

const options = {
    hostname: 'oppol-dug5.onrender.com',
    port: 443,
    path: '/api/admin/backfill-volume',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': adminSecret,
        'Content-Length': postData.length
    }
};

console.log('Calling backfill endpoint...');
console.log(`Admin secret: ${adminSecret.substring(0, 10)}...`);

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
    console.error('Request error:', error.message);
});

req.write(postData);
req.end();
