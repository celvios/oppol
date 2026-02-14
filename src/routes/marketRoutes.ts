import express from 'express';
import { ethers } from 'ethers';
import { CONFIG } from '../config/contracts';
import { query } from '../config/database';

const router = express.Router();

/**
 * POST /api/market/create
 * Gasless Market Creation for Holders (10M BC400 or 1 NFT)
 * 
 * Body:
 * - marketData: { question, image, description, outcomes, durationDays, category }
 * - userAddress: string
 * - signature: string (Signed message: "Create Market: [Question]...")
 * - timestamp: number
 */
router.post('/create', async (req, res) => {
    try {
        const { marketData, userAddress } = req.body;

        if (!marketData || !userAddress) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        console.log(`[Gasless Create] Request from ${userAddress}`);

        // 1. Setup Provider & Contract
        const rpcUrl = process.env.BNB_RPC_URL || CONFIG.RPC_URL;
        const chainId = parseInt(process.env.CHAIN_ID || '56');
        const provider = new ethers.JsonRpcProvider(rpcUrl, chainId);

        // Operator Wallet (Admin)
        const privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) throw new Error('Server wallet not configured');
        const signer = new ethers.Wallet(privateKey, provider);

        const MARKET_ADDR = process.env.NEXT_PUBLIC_MARKET_ADDRESS || process.env.MULTI_MARKET_ADDRESS;
        if (!MARKET_ADDR) throw new Error('Market contract not configured');

        // Check Operator Status (optional, debug)
        // console.log(`[Gasless Create] Operator: ${signer.address}`);

        // 2. Verify Holdings (Access Control)
        // We act as the gatekeeper off-chain to save gas on reverts
        const nftAddress = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS || '0xB929F588A6FfC35E3E723326F9233077e69F7628';
        const bc400Address = process.env.NEXT_PUBLIC_BC400_ADDRESS || '0x61Fc93c7C070B32B1b1479B86056d8Ec1D7125BD';
        const minBc400 = BigInt('10000000000000000000000000'); // 10M * 1e18

        const erc20Abi = ['function balanceOf(address) view returns (uint256)'];
        const erc721Abi = ['function balanceOf(address) view returns (uint256)'];

        const nftContract = new ethers.Contract(nftAddress, erc721Abi, provider);
        const bc400Contract = new ethers.Contract(bc400Address, erc20Abi, provider);

        const [nftBal, bc400Bal] = await Promise.all([
            nftContract.balanceOf(userAddress).catch(() => 0n),
            bc400Contract.balanceOf(userAddress).catch(() => 0n)
        ]);

        const hasAccess = nftBal > 0n || bc400Bal >= minBc400;

        if (!hasAccess) {
            console.log(`[Gasless Create] Denied: NFT=${nftBal}, BC400=${bc400Bal}`);
            return res.status(403).json({
                success: false,
                error: 'Insufficient holdings (Need 1 NFT or 10M BC400)'
            });
        }

        // 3. Submit Transaction
        const marketABI = [
            'function createMarketFor(address _creator, string memory _question, string memory _image, string memory _description, string[] memory _outcomes, uint256 _durationDays) external returns (uint256)',
            'function marketCount() view returns (uint256)'
        ];

        const contract = new ethers.Contract(MARKET_ADDR, marketABI, signer);

        console.log(`[Gasless Create] Creating market for ${userAddress}...`);

        const tx = await contract.createMarketFor(
            userAddress, // _creator
            marketData.question,
            marketData.image || "",
            marketData.description || "",
            marketData.outcomes,
            parseInt(marketData.durationDays)
        );

        console.log(`[Gasless Create] TX Sent: ${tx.hash}`);
        await tx.wait();

        // 4. Get Market ID & Save to DB
        const count = await contract.marketCount();
        const newMarketId = Number(count) - 1;

        // Save to DB
        await query(
            `INSERT INTO markets (market_id, question, description, image, category, outcome_names)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (market_id) DO UPDATE 
             SET question = $2, description = $3, image = $4, category = $5, outcome_names = $6`,
            [newMarketId, marketData.question, marketData.description, marketData.image, marketData.category, JSON.stringify(marketData.outcomes)]
        );

        return res.json({
            success: true,
            marketId: newMarketId,
            transactionHash: tx.hash
        });

    } catch (error: any) {
        console.error('[Gasless Create] Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
