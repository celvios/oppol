import fetch from 'node-fetch';

async function testDeposit() {
    const privyUserId = "did:privy:cmls108mq035i0cl89tnm1a2e";
    const apiUrl = "https://oppol-trade.onrender.com"; // User's prod url based on earlier context, or we can use localhost if running

    console.log("Testing deposit for:", privyUserId);

    try {
        const res = await fetch(`${apiUrl}/api/wallet/deposit-custodial`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ privyUserId })
        });

        const data = await res.json();
        console.log("Response:", data);
    } catch (e) {
        console.error("Fetch error:", e);
    }
}

testDeposit();
