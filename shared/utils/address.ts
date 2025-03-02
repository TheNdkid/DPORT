import { ethers } from "ethers";

const removeHexPrefix = (value: string): string => {
  return value.startsWith('0x') ? value.slice(2) : value;
};

const isValidHexFormat = (value: string): boolean => {
  const hexRegex = /^[0-9a-fA-F]+$/;
  return hexRegex.test(value);
};

const hasValidLength = (value: string): boolean => {
  return value.length === 40;
};

const addHexPrefix = (value: string): string => {
  return value.startsWith('0x') ? value : `0x${value}`;
};

export const normalizeAddress = (address: string | null): string | null => {
  if (!address || address === '0x') return null;

  try {
    const cleaned = address.toLowerCase().trim();

    // Try ICAP format first
    if (cleaned.startsWith('xe')) {
      return ethers.getIcapAddress(cleaned);
    }

    // Handle standard address format
    const normalized = ethers.getAddress(cleaned);
    return normalized === '0x' ? null : normalized;
  } catch (err) {
    console.error("Address normalization failed:", err);
    return null;
  }
};

export const isValidAddress = (address: string): boolean => {
  try {
    // Check for ICAP format
    if (address.startsWith('XE') || address.startsWith('xe')) {
      return ethers.isValidAddress(ethers.getIcapAddress(address));
    }
    // Standard format check
    return ethers.isAddress(address);
  } catch {
    return false;
  }
};

export function validateAndNormalizeAddress(address: string | null): string | null {
  try {
    if (!address) return null;

    // Strip any whitespace that might have been included
    const trimmed = address.trim();

    // Check for valid hexadecimal format with 0x prefix and 40 hex chars
    if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
      console.warn('Invalid address format:', trimmed);
      return null;
    }

    try {
      // Get checksum address
      return ethers.getAddress(trimmed);
    } catch (checksumError) {
      console.warn('Checksum validation failed, trying lowercase conversion:', checksumError);
      // Try again with lowercase as a fallback
      return ethers.getAddress(trimmed.toLowerCase());
    }
  } catch (error) {
    console.error('Address normalization failed:', error);
    return null;
  }
}

export const normalizeAddressOrThrow = (address: string): string => {
  const normalized = normalizeAddress(address);
  if (!normalized) {
    throw new Error(`Invalid address format: ${address}`);
  }
  return normalized;
};