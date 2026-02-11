const https = require('https');

const adminSecret = process.env.ADMIN_SECRET || 'oppol-admin-2026';

const options = {
    hostname: 'oppol-dug5.onrender.com',
    port: 443,
    path: '/api/admin/check-volume/4',
    method: 'GET',
    headers: {
        'x-admin-secret': adminSecret
    }
};

console.log('Checking database volume for Market 4...\n');

const req = https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log(JSON.stringify(json, null, 2));
        } catch (e) {
            console.log('Response:', data);
        }
    });
});

req.on('error', (error) => {
    console.error('Error:', error.message);
});

req.end();
