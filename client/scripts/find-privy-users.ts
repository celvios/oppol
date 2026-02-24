import { PrivyClient } from '@privy-io/server-auth';
import 'dotenv/config';

async function main() {
    const privy = new PrivyClient(
        process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
        process.env.PRIVY_APP_SECRET!
    );

    console.log("Searching Privy for user with wallet 0xd0A115...");
    try {
        const user = await privy.getUserByWalletAddress('0xd0A115Ea64B59F951B70276fCb65b4946465e3a9');
        console.log("✅ FOUND USER!");
        console.log(`User ID: ${user.id}`);
        console.log("Linked Accounts:");
        user.linkedAccounts.forEach(acc => {
            console.log(` - Type: ${acc.type}`);
            if (acc.type === 'wallet') {
                console.log(`   Address: ${acc.address}`);
                console.log(`   Client Type: ${acc.walletClientType}`);
            } else if (acc.type === 'google_oauth') {
                console.log(`   Email: ${acc.email}`);
            } else if (acc.type === 'email') {
                console.log(`   Email: ${acc.address}`);
            }
        });

    } catch (e: any) {
        console.log("❌ Not found by exact match. Fetching users list...");
        const users = await privy.getUsers();
        for (const u of users) {
            for (const acc of u.linkedAccounts) {
                if (acc.type === 'wallet' && acc.address.toLowerCase() === '0xd0a115ea64b59f951b70276fcb65b4946465e3a9') {
                    console.log(`✅ MATCH FOUND IN USER ${u.id}`);
                    console.log(JSON.stringify(acc, null, 2));
                    return;
                }
            }
        }
        console.log(`Not found in ${users.length} total users.`);
    }
}

main().catch(console.error);
