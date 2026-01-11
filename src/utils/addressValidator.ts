import { isAddress, getAddress } from 'ethers';

export function validateAddress(address: string, fieldName = 'Address'): string {
  if (!address) {
    throw new Error(`${fieldName} is required`);
  }
  
  if (typeof address !== 'string') {
    throw new Error(`${fieldName} must be a string, got ${typeof address}`);
  }
  
  if (address.includes('.eth') || address.includes('.crypto') || 
      (address.includes('.') && !address.startsWith('0x'))) {
    throw new Error(`${fieldName} appears to be an ENS name. ENS is not supported on BSC.`);
  }
  
  if (!isAddress(address)) {
    throw new Error(`${fieldName} is not a valid address format`);
  }
  
  return getAddress(address);
}
