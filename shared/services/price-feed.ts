
import { ethers } from 'ethers';

// Chainlink price feed ABI
const CHAINLINK_FEED_ABI = [
  'function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
  'function decimals() external view returns (uint8)'
];

// Chainlink price feeds on Base
const PRICE_FEEDS = {
  'ETH': '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70',
  'WETH': '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70',
  'USDC': '0x7e860098F58bBFC8648a4311b374B1D669a2bc6B',
  'SPX': '0x8BB1995A9567Ee5714eE634EF04b5C52D8B30784',  // SPX/USD price feed
  'TOSHI': '0x0Ac7B00Cf00915B31f741B3A21962ecfB96FE28A', // TOSHI/USD price feed
  'MOG': '0x4490b85B869107745F3e1549982a5293759aA5B2'  // MOG/USD price feed
};

// Token addresses on Base
const TOKEN_ADDRESSES = {
  'ETH': '0x0000000000000000000000000000000000000000', // Native ETH
  'WETH': '0x4200000000000000000000000000000000000006',
  'USDC': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  'SPX': '0xc1Caf0C19A8AC28c41Fe59bA6c754e4b9bd54de9',
  'TOSHI': '0x8544Fe9d190fD7EC52860abBf45088E81Ee24a8c',
  'MOG': '0x4490b85B869107745F3e1549982a5293759aA5B2'
};

// Fallback prices for when feeds are unavailable
const FALLBACK_PRICES = {
  'ETH': 3000,
  'WETH': 3000,
  'USDC': 1,
  'SPX': 0.15,
  'TOSHI': 1.25,
  'MOG': 0.08
};

/**
 * Get the price of a token using Chainlink price feeds
 * @param provider Ethers provider
 * @param symbol Token symbol
 * @param address Token address (optional)
 * @returns Token price in USD
 */
export async function getTokenPrice(provider: ethers.Provider, symbol: string, address?: string): Promise<number> {
  try {
    // Normalize the symbol
    const normalizedSymbol = symbol?.toUpperCase();
    
    // Try to get price from Chainlink feed
    const feedAddress = PRICE_FEEDS[normalizedSymbol];
    
    if (feedAddress) {
      try {
        const feed = new ethers.Contract(feedAddress, CHAINLINK_FEED_ABI, provider);
        const roundData = await feed.latestRoundData();
        const decimals = await feed.decimals();
        return Number(roundData.answer) / Math.pow(10, decimals);
      } catch (feedError) {
        console.warn(`Error fetching price from feed for ${normalizedSymbol}:`, feedError);
        // Fall through to fallback
      }
    }
    
    // Use fallback price
    const fallbackPrice = FALLBACK_PRICES[normalizedSymbol];
    if (fallbackPrice !== undefined) {
      return fallbackPrice;
    }
    
    // Last resort - return 0
    console.warn(`No price available for ${normalizedSymbol}`);
    return 0;
  } catch (error) {
    console.error(`Error in getTokenPrice for ${symbol}:`, error);
    return 0;
  }
}

/**
 * Get the address of a token by symbol
 * @param symbol Token symbol
 * @returns Token address or undefined
 */
export function getTokenAddressBySymbol(symbol: string): string | undefined {
  return TOKEN_ADDRESSES[symbol?.toUpperCase()];
}

/**
 * Get the symbol of a token by address
 * @param address Token address
 * @returns Token symbol or undefined
 */
export function getTokenSymbolByAddress(address: string): string | undefined {
  if (!address) return undefined;
  
  // Normalize address
  try {
    const normalizedAddress = ethers.getAddress(address);
    
    // Find matching token
    for (const [symbol, tokenAddress] of Object.entries(TOKEN_ADDRESSES)) {
      if (tokenAddress.toLowerCase() === normalizedAddress.toLowerCase()) {
        return symbol;
      }
    }
  } catch (error) {
    console.error(`Invalid address format: ${address}`, error);
  }
  
  return undefined;
}
