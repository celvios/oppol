require('dotenv').config({ path: '.env' });
const { ethers } = require('ethers');
const fs = require('fs');
const w = new ethers.Wallet(process.env.PRIVATE_KEY);
const z = ethers.getCreateAddress({ from: w.address, nonce: 24 });
fs.writeFileSync('zap_addr.txt', z);
console.log('done');
