
import { useState } from 'react';
import { useConnectorClient, useAccount } from 'wagmi';
import { clientToSigner } from "@/lib/viem-ethers-adapters";
import { Contract, ethers } from 'ethers';
import { getContracts } from "@/lib/contracts";

// Minimal ABIs
const ERC20_ABI = [
    { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
    { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
    { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
];

const MARKET_ABI = [
    { name: 'deposit', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
];

export function useDeposit() {
    const { data: connectorClient } = useConnectorClient();
    const { address } = useAccount();
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [error, setError] = useState<string | null>(null);

    const deposit = async (amount: string, tokenAddress: string, isNative: boolean = false) => {
        setIsProcessing(true);
        setStatusMessage('Preparing transaction...');
        setError(null);

        try {
            if (!connectorClient) throw new Error('Wallet not connected');
            if (!address) throw new Error('No address found');

            const signer = clientToSigner(connectorClient);
            const contracts = getContracts() as any;
            const MARKET_CONTRACT = process.env.NEXT_PUBLIC_MARKET_ADDRESS || contracts.predictionMarket;

            if (!MARKET_CONTRACT) throw new Error('Market contract not configured');

            const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://bsc-dataseed.binance.org/';
            const provider = new ethers.JsonRpcProvider(rpcUrl);

            // 1. Determine Decimals and Parse Amount
            let decimals = 18;
            if (!isNative) {
                const tokenContract = new Contract(tokenAddress, ERC20_ABI, provider);
                decimals = await tokenContract.decimals();
            }
            const amountInWei = ethers.parseUnits(amount, decimals);

            // 2. Approve (if not native)
            if (!isNative) {
                const tokenContractRead = new Contract(tokenAddress, ERC20_ABI, provider);
                const currentAllowance = await tokenContractRead.allowance(address, MARKET_CONTRACT);

                if (currentAllowance < amountInWei) {
                    setStatusMessage(`Approving token...`);
                    const tokenContractWrite = new Contract(tokenAddress, ERC20_ABI, signer);
                    const approveTx = await tokenContractWrite.approve(MARKET_CONTRACT, amountInWei);
                    await approveTx.wait();
                }
            }

            // 3. Deposit
            setStatusMessage('Depositing...');
            const marketContract = new Contract(MARKET_CONTRACT, MARKET_ABI, signer);

            // Note: The contracts/contracts/PredictionMarketMultiV2.sol deposit function is NOT payable.
            // It uses transferFrom. So we can't deposit native BNB directly via 'deposit'.
            // Native BNB deposit usually goes via a specific 'depositNative' or Zap contract.
            // For this hook, we assume we are depositing the base token (USDC/USDT) which is ERC20.

            if (isNative) {
                throw new Error("Direct native deposit not supported by this hook yet (requires Zap)");
            }

            const tx = await marketContract.deposit(amountInWei);
            const receipt = await tx.wait();

            return receipt.hash;

        } catch (err: any) {
            console.error('Deposit Error:', err);
            let msg = err.message || 'Deposit failed';
            if (err.code === 'ACTION_REJECTED' || err.message?.includes('user rejected')) {
                msg = 'Transaction rejected';
            }
            setError(msg);
            throw new Error(msg);
        } finally {
            setIsProcessing(false);
            setStatusMessage('');
        }
    };

    return {
        deposit,
        isProcessing,
        statusMessage,
        error
    };
}
