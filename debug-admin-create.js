const fetch = require('node-fetch');

async function testAdminCreateMarket() {
    const API_URL = 'http://localhost:3001';
    const ADMIN_SECRET = 'admin123';
    
    const testMarket = {
        question: "Test Market - Will this work?",
        outcomes: ["Yes", "No"],
        category: "Test",
        image: "",
        description: "This is a test market to debug the admin creation issue",
        durationDays: 7
    };

    try {
        console.log('🔍 Testing admin market creation...');
        console.log('API URL:', API_URL);
        console.log('Admin Secret:', ADMIN_SECRET);
        console.log('Test Market:', JSON.stringify(testMarket, null, 2));

        const response = await fetch(`${API_URL}/api/admin/create-market-v2`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-secret': ADMIN_SECRET
            },
            body: JSON.stringify(testMarket)
        });

        console.log('Response Status:', response.status);
        console.log('Response Headers:', Object.fromEntries(response.headers.entries()));

        const responseText = await response.text();
        console.log('Raw Response:', responseText);

        try {
            const data = JSON.parse(responseText);
            console.log('Parsed Response:', JSON.stringify(data, null, 2));
        } catch (e) {
            console.log('Failed to parse JSON response');
        }

    } catch (error) {
        console.error('❌ Error testing admin create:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Also test basic API health
async function testAPIHealth() {
    try {
        console.log('🔍 Testing API health...');
        const response = await fetch('http://localhost:3001/api/health');
        const data = await response.json();
        console.log('✅ API Health:', data);
    } catch (error) {
        console.error('❌ API Health Check Failed:', error.message);
    }
}

async function main() {
    await testAPIHealth();
    console.log('\n' + '='.repeat(50) + '\n');
    await testAdminCreateMarket();
}

main();