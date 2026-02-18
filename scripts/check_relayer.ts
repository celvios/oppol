
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const key = process.env.PRIVATE_KEY;
if (key) {
    const wallet = new ethers.Wallet(key);
    console.log("RELAYER_ADDRESS=" + wallet.address);
} else {
    console.log("NO_KEY");
}
