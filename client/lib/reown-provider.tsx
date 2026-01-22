'use client';

import { ReactNode } from 'react';

/**
 * ReownProvider - Passthrough provider for backward compatibility
 * Actual wallet functionality is handled by Web3Provider's WagmiBridge
 */
export function ReownProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

// Export helpers for backward compatibility
export function getAppKitInstance() {
  // Return the modal from window if available
  return (typeof window !== 'undefined' && (window as any).web3modal) || null;
}

export async function waitForAppKit(): Promise<any> {
  // Return the modal from window if available
  return (typeof window !== 'undefined' && (window as any).web3modal) || null;
}
