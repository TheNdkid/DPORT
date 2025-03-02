import { ethers } from "ethers";

export const normalizeAddress = (address: string): string | null => {
  if (!address || typeof address !== 'string') {
    console.warn("Invalid address input:", address);
    return null;
  }

  try {
    return ethers.getAddress(address.toLowerCase().trim());

    // Handle checksum by trying multiple approaches
    try {
      // Try direct validation first
      return ethers.getAddress(address);
    } catch {
      // If that fails, try lowercase
      try {
        return ethers.getAddress(address.toLowerCase());
      } catch {
        // Last resort - strip "0x" and try again
        const stripped = address.substring(2);
        return ethers.getAddress("0x" + stripped);
      }
    }
  } catch (err) {
    const error = err as Error;
    console.warn("Address normalization failed:", { address, error: error.message });
    return null;
  }
};

export const isValidAddress = (address: string): boolean => {
    return normalizeAddress(address) !== null;
};

export const validateAndNormalizeAddress = (address: string): string => {
    const normalized = normalizeAddress(address);
    if (!normalized) {
        throw new Error(`Invalid Ethereum address: ${address}`);
    }
    return normalized;
};

export const normalizeAddressOrThrow = (address: string): string => {
    const normalized = normalizeAddress(address);
    if (!normalized) {
        throw new Error(`Invalid address format: ${address}`);
    }
    return normalized;
};
