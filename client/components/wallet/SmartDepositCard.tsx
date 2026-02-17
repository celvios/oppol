
import { ArrowRight, Wallet, CheckCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { useDeposit } from "@/hooks/useDeposit";
import { useWallet } from "@/lib/use-wallet";

interface SmartDepositCardProps {
    walletBalance: string;
    tokenSymbol?: string;
    tokenAddress?: string;
    onDepositSuccess?: () => void;
}

export default function SmartDepositCard({
    walletBalance,
    tokenSymbol = "USDC", // Default to USDC as that's the main token
    tokenAddress = process.env.NEXT_PUBLIC_USDC_CONTRACT || '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    onDepositSuccess
}: SmartDepositCardProps) {
    const { deposit, isProcessing, statusMessage, error } = useDeposit();
    const { address } = useWallet();
    const [isSuccess, setIsSuccess] = useState(false);

    const balanceNum = parseFloat(walletBalance);

    if (balanceNum <= 0) return null;

    const handleSmartDeposit = async () => {
        try {
            await deposit(walletBalance, tokenAddress, false);
            setIsSuccess(true);
            if (onDepositSuccess) {
                // Wait a bit for the user to see the success state before refreshing
                setTimeout(onDepositSuccess, 2000);
            }
        } catch (e) {
            console.error("Smart deposit failed", e);
        }
    };

    if (isSuccess) {
        return (
            <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-6 flex flex-col items-center text-center animate-fadeIn">
                <CheckCircle className="w-12 h-12 text-green-500 mb-2 animate-bounce" />
                <h3 className="text-xl font-bold text-white mb-1">Funds Added!</h3>
                <p className="text-white/60 text-sm">Your balance has been updated.</p>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-white/10 rounded-2xl p-6 relative overflow-hidden group">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-indigo-500/30 transition-all duration-700"></div>

            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4 text-center md:text-left">
                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                        <Wallet className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 justify-center md:justify-start mb-1">
                            <h3 className="text-lg font-bold text-white">Funds Ready to Play</h3>
                            <span className="px-2 py-0.5 bg-green-500 text-black text-[10px] font-bold uppercase rounded-full">Detected</span>
                        </div>
                        <p className="text-white/60 text-sm">
                            We found <span className="text-white font-mono font-bold">{walletBalance} {tokenSymbol}</span> in your wallet.
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleSmartDeposit}
                    disabled={isProcessing}
                    className="w-full md:w-auto px-6 py-3 bg-white hover:bg-white/90 text-black font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_rgba(255,255,255,0.4)]"
                >
                    {isProcessing ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            {statusMessage || 'Processing...'}
                        </>
                    ) : (
                        <>
                            Add to Game Balance
                            <ArrowRight className="w-5 h-5" />
                        </>
                    )}
                </button>
            </div>

            {error && (
                <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-200 text-sm text-center">
                    {error}
                </div>
            )}
        </div>
    );
}
