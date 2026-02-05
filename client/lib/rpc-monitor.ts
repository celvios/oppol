/**
 * RPC Usage Monitor
 * 
 * This script intercepts ethers.js RPC calls to track usage patterns.
 * Use this to identify which parts of your app are making excessive RPC calls.
 * 
 * Usage:
 * 1. Import at the top of your app: import '@/lib/rpc-monitor'
 * 2. Check console for RPC usage reports
 * 3. Call getRPCStats() to get detailed breakdown
 */

interface RPCCall {
    method: string;
    timestamp: number;
    stackTrace: string;
}

interface RPCStats {
    totalCalls: number;
    callsByMethod: Record<string, number>;
    callsByMinute: number;
    recentCalls: RPCCall[];
    topCallers: Array<{ method: string; count: number; lastCaller: string }>;
}

class RPCMonitor {
    private calls: RPCCall[] = [];
    private startTime = Date.now();
    private reportInterval: NodeJS.Timeout | null = null;

    constructor() {
        if (typeof window === 'undefined') return;
        this.interceptFetch();
        this.startReporting();
    }

    private interceptFetch() {
        const originalFetch = window.fetch;
        const self = this;

        window.fetch = function (...args: Parameters<typeof fetch>) {
            const url = args[0].toString();

            // Only track RPC calls (not API calls)
            if (url.includes('publicnode.com') || url.includes('rpc') || url.includes('binance.org')) {
                const stack = new Error().stack || '';
                const method = self.extractMethod(args);

                self.calls.push({
                    method,
                    timestamp: Date.now(),
                    stackTrace: stack
                });

                // Log high-frequency calls immediately
                const recentSimilar = self.calls.filter(
                    c => c.method === method && Date.now() - c.timestamp < 5000
                ).length;

                if (recentSimilar > 10) {
                    console.warn(`🔥 HIGH FREQUENCY RPC: ${method} called ${recentSimilar} times in 5s`);
                    console.trace('Called from:');
                }
            }

            return originalFetch.apply(this, args);
        };
    }

    private extractMethod(args: Parameters<typeof fetch>): string {
        try {
            if (args[1]?.body) {
                const body = JSON.parse(args[1].body as string);
                return body.method || 'unknown';
            }
        } catch (e) {
            // Not JSON or no body
        }
        return 'unknown';
    }

    private startReporting() {
        // Report every 30 seconds
        this.reportInterval = setInterval(() => {
            this.printReport();
        }, 30000);

        // Also report on page unload
        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', () => this.printReport());
        }
    }

    getStats(): RPCStats {
        const now = Date.now();
        const minuteAgo = now - 60000;
        const recentCalls = this.calls.filter(c => c.timestamp > minuteAgo);

        const callsByMethod: Record<string, number> = {};
        this.calls.forEach(call => {
            callsByMethod[call.method] = (callsByMethod[call.method] || 0) + 1;
        });

        const topCallers = Object.entries(callsByMethod)
            .map(([method, count]) => {
                const lastCall = this.calls.filter(c => c.method === method).pop();
                return {
                    method,
                    count,
                    lastCaller: this.extractCallerFromStack(lastCall?.stackTrace || '')
                };
            })
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        return {
            totalCalls: this.calls.length,
            callsByMethod,
            callsByMinute: recentCalls.length,
            recentCalls: this.calls.slice(-50),
            topCallers
        };
    }

    private extractCallerFromStack(stack: string): string {
        const lines = stack.split('\n');
        // Find first line that's not from ethers or this monitor
        const caller = lines.find(line =>
            !line.includes('rpc-monitor') &&
            !line.includes('ethers') &&
            !line.includes('node_modules') &&
            line.includes('at ')
        );
        return caller?.trim() || 'unknown';
    }

    printReport() {
        const stats = this.getStats();
        const elapsed = (Date.now() - this.startTime) / 1000;

        console.group('📊 RPC Usage Report');
        console.log(`⏱️  Running for: ${elapsed.toFixed(0)}s`);
        console.log(`📞 Total RPC calls: ${stats.totalCalls}`);
        console.log(`⚡ Calls/minute: ${stats.callsByMinute}`);
        console.log(`📈 Rate: ${(stats.totalCalls / (elapsed / 60)).toFixed(2)} calls/min`);

        console.log('\n🔝 Top Methods:');
        stats.topCallers.forEach((caller, i) => {
            console.log(`  ${i + 1}. ${caller.method}: ${caller.count} calls`);
            console.log(`     Last from: ${caller.lastCaller}`);
        });

        // Alert if usage is extremely high
        if (stats.callsByMinute > 100) {
            console.error('🚨 CRITICAL: Over 100 RPC calls/minute! Check your polling intervals!');
        } else if (stats.callsByMinute > 50) {
            console.warn('⚠️  WARNING: High RPC usage detected. Consider increasing cache TTL.');
        }

        console.groupEnd();
    }

    reset() {
        this.calls = [];
        this.startTime = Date.now();
    }
}

// Global instance
let monitor: RPCMonitor | null = null;

if (typeof window !== 'undefined') {
    monitor = new RPCMonitor();

    // Expose to window for manual inspection
    (window as any).getRPCStats = () => monitor?.getStats();
    (window as any).printRPCReport = () => monitor?.printReport();
    (window as any).resetRPCMonitor = () => monitor?.reset();

    console.log('🔍 RPC Monitor initialized. Use window.getRPCStats() or window.printRPCReport()');
}

export default monitor;
