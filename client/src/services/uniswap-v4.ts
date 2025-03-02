import { ethers } from 'ethers';

import { normalizeAddressOrThrow } from '@shared/utils/address';

// Contract addresses with proper checksums for Base mainnet
export const UNISWAP_V4_ADDRESSES = {
  singleton: normalizeAddressOrThrow('0x7cad26499621783a986aebbf15d92e5c9cc04aa4')
};

// Initialize contract with proper error handling
export const initializeV4Contract = (provider: ethers.Provider, address: string) => {
  try {
    const normalizedAddress = normalizeAddressOrThrow(address);
    return new ethers.Contract(normalizedAddress, V4_POOL_ABI, provider); // Use V4_POOL_ABI here
  } catch (error) {
    console.error('Failed to initialize V4 contract:', error);
    throw error;
  }
};

const V4_POOL_ABI = [
  'function getUserPosition(address user) view returns (tuple(uint256 liquidity, int24 tickLower, int24 tickUpper, uint256 tokensOwed0, uint256 tokensOwed1))',
  'function token0() view returns (address)',
  'function token1() view returns (address)'
];

// Added Uniswap V4 singleton ABI
const UNISWAP_V4_SINGLETON_ABI = [
  'function getPosition(address pool, address owner) view returns (tuple(uint256 liquidity, uint256 amount0, uint256 amount1) position)',
  'function isValidPool(address pool) view returns (bool)'
];


export interface UniswapV4Position {
  liquidity: string;
  tickLower: number;
  tickUpper: number;
  tokensOwed0: string;
  tokensOwed1: string;
  minPrice?: string;
  maxPrice?: string;
  poolAddress?: string;
}

export async function getUniswapV4Positions(
  provider: ethers.JsonRpcProvider,
  walletAddress: string,
  poolAddress: string,
  
): Promise<UniswapV4Position | null> {
  console.log('Starting Uniswap V4 position fetch for:', walletAddress);
  console.log('Checking pool:', poolAddress);

  try {
    const singleton = new ethers.Contract(
      UNISWAP_V4_ADDRESSES.singleton,
      UNISWAP_V4_SINGLETON_ABI,
      provider
    );
    
    // Validate pool first
    const isValid = await singleton.isValidPool(poolAddress);
    if (!isValid) {
      console.log('Invalid V4 pool address:', poolAddress);
      return null;
    }
    
    console.log('Checking V4 position in pool:', poolAddress);

    // Normalize addresses first
    const normalizedWallet = normalizeAddressOrThrow(walletAddress);
    const normalizedPool = normalizeAddressOrThrow(poolAddress);

    const position = await singleton.getPosition(normalizedPool, normalizedWallet);

    if (position.liquidity.toString() === '0') {
      console.log('Position has zero liquidity, skipping');
      return null;
    }

    //  Since we only get liquidity from singleton, we'll return a minimal representation.  
    //  To get full position data, we'd need to query the pool contract directly.
    return {
      liquidity: position.liquidity.toString(),
      tokensOwed0: position.amount0.toString(),
      tokensOwed1: position.amount1.toString(),
      poolAddress: normalizedPool,
      tickLower: 0, // Placeholder - requires additional logic to fetch from pool
      tickUpper: 0  // Placeholder - requires additional logic to fetch from pool

    };
  } catch (error) {
    console.error('Error fetching Uniswap V4 position:', error);
    console.error('Error context:', {
      provider: !!provider,
      walletAddress,
      poolAddress,
    });
    return null;
  }
}