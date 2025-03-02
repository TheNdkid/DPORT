import { ethers } from 'ethers';
import { checkLPNFTPosition, getPositionPriceRange } from './nft-position-scanner';
import { db } from '../lib/db';
import { liquidityPoolCache } from '../../shared/schema';
import type { Pool } from '../../shared/schema';
import { eq, and, gt } from 'drizzle-orm';
import { normalizeAddress, isValidAddress } from '@shared/utils/address';

// Price feeds configuration
const PRICE_FEEDS: Record<string, string> = {
  ETH: '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70', // ETH/USD
  // Add more price feeds as needed
};

// Update token addresses with normalized versions
const COMMON_TOKENS = {
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  WETH: '0x4200000000000000000000000000000000000006',
  USDbC: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',
  USDBC: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA'
};

// Initialize DEX addresses with proper checksums
const DEX_ADDRESSES = {
  uniswap: {
    factory: normalizeAddress('0x33128a8fc17869897dce68ed026d694621f6fdfd')!,
    router: normalizeAddress('0x2626664c2603336E57B271c5C0b26F421741e481')!,
    positionManager: normalizeAddress('0x03a520b32C04BF3bE5F46762FCe6CD5031F498C2')!
  },
  aerodrome: {
    factory: normalizeAddress('0x420DD381b31aEf6683db6B902084cB0FFECe40Da')!,
    router: normalizeAddress('0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43')!,
    positionManager: normalizeAddress('0x82792F8f57635DC7e4C78fEB5A7A2CFd102a1CC3')!
  }
};

// Initialize common tokens with normalized addresses
Object.keys(COMMON_TOKENS).forEach(key => {
  const normalized = normalizeAddress(COMMON_TOKENS[key as keyof typeof COMMON_TOKENS]);
  if (normalized) {
    COMMON_TOKENS[key as keyof typeof COMMON_TOKENS] = normalized;
  }
});

// Chain Link Price Feed ABI for price fetching
const CHAINLINK_FEED_ABI = [
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
  'function decimals() view returns (uint8)'
];

// Price feed addresses on Base

// Chain Link Price Feed ABI for price fetching

// Price feed addresses on Base

// Update DEX addresses with normalized versions

//const DEX_ADDRESSES = {
//  uniswap: {
//    factory: '0x33128a8fc17869897dce68ed026d694621f6fdfd',
//    router: '0x2626664c2603336E57B271c5C0b26F421741e481',
//    positionManager: '0x03a520b32C04BF3bE5F46762FCe6CD5031F498C2'
//  },
//  aerodrome: {
//    factory: '0x420DD381b31aEf6683db6B902084cB0FFECe40Da',
//    router: '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43',
//    positionManager: '0x82792F8f57635DC7e4C78fEB5A7A2CFd102a1CC3'
//  }
//};

const FACTORY_ABI = [
  'function allPools(uint256) view returns (address)',
  'function allPoolsLength() view returns (uint256)',
  'function getPair(address tokenA, address tokenB) view returns (address)'
];

const POOL_ABI = [
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function fee() view returns (uint24)',
  'function liquidity() view returns (uint128)',
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function balanceOf(address) view returns (uint256)'
];

const ERC20_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)'
];

async function getTokenPrice(provider: ethers.JsonRpcProvider, symbol: string, address: string): Promise<number> {
  try {
    // First try Chainlink price feeds
    if (PRICE_FEEDS[symbol.toUpperCase()]) {
      const priceFeed = new ethers.Contract(PRICE_FEEDS[symbol.toUpperCase()], CHAINLINK_FEED_ABI, provider);
      const [roundData, decimals] = await Promise.all([
        priceFeed.latestRoundData(),
        priceFeed.decimals()
      ]);
      return Number(roundData.answer) / (10 ** decimals);
    }

    // For stablecoins, return 1
    if (['USDC', 'USDT', 'DAI', 'USDBC'].includes(symbol.toUpperCase())) {
      return 1;
    }

    // For other tokens, try to get price from USDC pair
    const uniswapFactory = new ethers.Contract(DEX_ADDRESSES.uniswap.factory, FACTORY_ABI, provider);
    const pairAddress = await uniswapFactory.getPair(address, COMMON_TOKENS.USDC);

    if (pairAddress !== ethers.ZeroAddress) {
      const pair = new ethers.Contract(pairAddress, POOL_ABI, provider);
      const [token0, reserves] = await Promise.all([
        pair.token0(),
        pair.getReserves()
      ]);

      const [reserve0, reserve1] = reserves;
      const isToken0 = address.toLowerCase() === token0.toLowerCase();

      // Calculate price based on USDC reserves
      return isToken0
        ? Number(ethers.formatUnits(reserve1, 6)) / Number(ethers.formatUnits(reserve0, 18))
        : Number(ethers.formatUnits(reserve0, 6)) / Number(ethers.formatUnits(reserve1, 18));
    }

    throw new Error(`No price source found for ${symbol}`);
  } catch (error) {
    console.error(`Error fetching price for ${symbol}:`, error);
    // Return last known price or a default value
    if (symbol.toUpperCase() === 'ETH' || symbol.toUpperCase() === 'WETH') {
      return 3000; // Fallback price for ETH
    }
    return 0; // Indicates price fetch failed
  }
}

function tickToPrice(tick: number, decimals0: number, decimals1: number): number {
  const price = 1.0001 ** tick;
  return price * (10 ** (decimals1 - decimals0));
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
const PAGE_SIZE = 10;

export async function scanPools(
  provider: ethers.JsonRpcProvider,
  page: number = 1,
  forceRefresh: boolean = false
): Promise<{ pools: Pool[], hasMore: boolean }> {
  try {
    if (!provider || !(provider instanceof ethers.JsonRpcProvider)) {
      console.error('Invalid provider:', provider);
      return { pools: [], hasMore: false };
    }

    console.log('Starting pool scan with pagination...', { page, forceRefresh });

    const network = await provider.getNetwork();
    console.log('Connected to network:', {
      chainId: network.chainId,
      name: network.name
    });

    const isBaseNetwork = Number(network.chainId) === 8453 || Number(network.chainId) === 84531;
    if (!isBaseNetwork) {
      console.error('Not connected to Base network');
      return { pools: [], hasMore: false };
    }

    // Try to get cached pools first if not forcing refresh
    if (!forceRefresh) {
      const cachedPools = await getCachedPools(page);
      if (cachedPools.length > 0) {
        console.log('Returning cached pools');
        return {
          pools: cachedPools,
          hasMore: cachedPools.length === PAGE_SIZE
        };
      }
    }

    const signer = await provider.getSigner();
    const walletAddress = await signer.getAddress();

    const commonPairs = [
      { token0: COMMON_TOKENS.USDC, token1: COMMON_TOKENS.WETH },
      { token0: COMMON_TOKENS.WETH, token1: COMMON_TOKENS.USDBC },
      { token0: COMMON_TOKENS.USDC, token1: COMMON_TOKENS.USDBC }
    ];

    // Scan pools in parallel
    const [uniswapPools, aerodromePools] = await Promise.all([
      scanUniswapV3Pools(provider, commonPairs, walletAddress),
      scanAerodromePools(provider, commonPairs, walletAddress)
    ]);

    const allPools = [
      ...(uniswapPools || []),
      ...(aerodromePools || [])
    ].sort((a, b) => Number(b.tvl) - Number(a.tvl));

    // Cache the pools
    await cachePools(allPools);

    // Return paginated results
    const startIdx = (page - 1) * PAGE_SIZE;
    const paginatedPools = allPools.slice(startIdx, startIdx + PAGE_SIZE);

    return {
      pools: paginatedPools,
      hasMore: startIdx + PAGE_SIZE < allPools.length
    };
  } catch (error) {
    console.error('Error in pool scanner:', error);
    return { pools: [], hasMore: false };
  }
}

async function getCachedPools(page: number): Promise<Pool[]> {
  try {
    const startIdx = (page - 1) * PAGE_SIZE;
    const cacheExpiry = new Date(Date.now() - CACHE_TTL);

    const cachedPools = await db
      .select()
      .from(liquidityPoolCache)
      .where(gt(liquidityPoolCache.lastUpdated, cacheExpiry))
      .offset(startIdx)
      .limit(PAGE_SIZE);

    if (cachedPools.length === 0) return [];

    return cachedPools.map((pool: typeof liquidityPoolCache.$inferSelect) => ({
      id: pool.poolAddress,
      protocol: pool.protocol,
      token0Symbol: pool.token0Symbol,
      token1Symbol: pool.token1Symbol,
      tvl: pool.tvl.toString(),
      apr: pool.apr.toString(),
      volume24h: pool.volume24h.toString(),
      fee: Number(pool.fee),
      isNFT: pool.isNFT,
      token0Address: pool.token0Address,
      token1Address: pool.token1Address,
      priceRange: pool.priceRangeLower && pool.priceRangeUpper ? {
        lower: pool.priceRangeLower.toString(),
        upper: pool.priceRangeUpper.toString()
      } : undefined
    }));
  } catch (error) {
    console.error('Error fetching cached pools:', error);
    return [];
  }
}

async function cachePools(pools: Pool[]): Promise<void> {
  try {
    const now = new Date();

    for (const pool of pools) {
      await db
        .insert(liquidityPoolCache)
        .values({
          poolAddress: pool.id,
          protocol: pool.protocol,
          token0Symbol: pool.token0Symbol,
          token1Symbol: pool.token1Symbol,
          token0Address: pool.token0Address, // Added token addresses
          token1Address: pool.token1Address, // Added token addresses
          tvl: Number(pool.tvl),
          volume24h: Number(pool.volume24h),
          apr: Number(pool.apr),
          fee: pool.fee,
          priceRangeLower: pool.priceRange ? Number(pool.priceRange.lower) : null,
          priceRangeUpper: pool.priceRange ? Number(pool.priceRange.upper) : null,
          isNFT: pool.isNFT || false,
          lastUpdated: now
        })
        .onConflictDoUpdate({
          target: liquidityPoolCache.poolAddress,
          set: {
            tvl: Number(pool.tvl),
            volume24h: Number(pool.volume24h),
            apr: Number(pool.apr),
            priceRangeLower: pool.priceRange ? Number(pool.priceRange.lower) : null,
            priceRangeUpper: pool.priceRange ? Number(pool.priceRange.upper) : null,
            lastUpdated: now
          }
        });
    }
  } catch (error) {
    console.error('Error caching pools:', error);
  }
}

async function scanUniswapV3Pools(
  provider: ethers.JsonRpcProvider,
  commonPairs: { token0: string; token1: string; }[],
  walletAddress: string
): Promise<Pool[]> {
  try {
    console.log('Scanning Uniswap V3 pools...');
    const factory = new ethers.Contract(DEX_ADDRESSES.uniswap.factory, FACTORY_ABI, provider);
    const pools: Pool[] = [];

    for (const pair of commonPairs) {
      try {
        const poolAddress = await factory.getPair(pair.token0, pair.token1);
        if (poolAddress === ethers.ZeroAddress) continue;

        console.log(`Checking Uniswap NFT positions for pool ${poolAddress}`);
        const nftPosition = await checkLPNFTPosition(
          provider,
          DEX_ADDRESSES.uniswap.positionManager,
          poolAddress,
          walletAddress
        );

        let priceRange = undefined;
        let isNFT = false;
        if (nftPosition) {
          priceRange = getPositionPriceRange(nftPosition);
          isNFT = true;
          console.log('Found NFT position with price range:', priceRange);
        }

        const pool = new ethers.Contract(poolAddress, POOL_ABI, provider);
        const [token0Contract, token1Contract] = [
          new ethers.Contract(pair.token0, ERC20_ABI, provider),
          new ethers.Contract(pair.token1, ERC20_ABI, provider)
        ];

        const [symbol0, symbol1, decimals0, decimals1, reserves, fee, slot0] = await Promise.all([
          token0Contract.symbol(),
          token1Contract.symbol(),
          token0Contract.decimals(),
          token1Contract.decimals(),
          pool.getReserves(),
          pool.fee(),
          pool.slot0()
        ]);

        // Use more accurate price fetching
        const [token0Price, token1Price] = await Promise.all([
          getTokenPrice(provider, symbol0, pair.token0),
          getTokenPrice(provider, symbol1, pair.token1)
        ]);

        if (token0Price === 0 || token1Price === 0) {
          console.warn(`Skipping pool due to missing price data: ${symbol0}/${symbol1}`);
          continue;
        }

        const reserve0 = Number(ethers.formatUnits(reserves[0], decimals0));
        const reserve1 = Number(ethers.formatUnits(reserves[1], decimals1));
        const currentTick = slot0[1];

        const tvl = (reserve0 * token0Price) + (reserve1 * token1Price);
        const volume24h = tvl * 0.1; // This should be fetched from an API in production
        const apr = calculateAPR(volume24h, tvl, Number(fee));

        const currentPrice = tickToPrice(currentTick, decimals0, decimals1);

        pools.push({
          id: poolAddress,
          protocol: 'Uniswap V3',
          token0Symbol: symbol0,
          token1Symbol: symbol1,
          tvl: tvl.toString(),
          apr: apr.toFixed(2),
          volume24h: volume24h.toString(),
          fee: Number(fee) / 10000,
          isNFT,
          priceRange: priceRange || {
            lower: (currentPrice * 0.8).toString(),
            upper: (currentPrice * 1.2).toString()
          },
          token0Address: pair.token0, // Added token addresses
          token1Address: pair.token1 // Added token addresses
        });

      } catch (error) {
        console.error(`Error processing Uniswap pair:`, error);
        continue;
      }
    }

    return pools;
  } catch (error) {
    console.error('Error scanning Uniswap pools:', error);
    return [];
  }
}

async function scanAerodromePools(
  provider: ethers.JsonRpcProvider,
  commonPairs: { token0: string; token1: string; }[],
  walletAddress: string
): Promise<Pool[]> {
  try {
    console.log('Scanning Aerodrome pools...');
    const factory = new ethers.Contract(DEX_ADDRESSES.aerodrome.factory, FACTORY_ABI, provider);
    const pools: Pool[] = [];

    for (const pair of commonPairs) {
      try {
        // Normalize addresses before using them
        const fixedToken0 = normalizeAddress(pair.token0);
        const fixedToken1 = normalizeAddress(pair.token1);
        const fixedWalletAddress = normalizeAddress(walletAddress);

        if (!fixedToken0 || !fixedToken1 || !fixedWalletAddress) {
          console.warn("Invalid addresses detected. Skipping contract call.", {
            token0: pair.token0,
            token1: pair.token1,
            wallet: walletAddress
          });
          continue;
        }

        const poolAddress = await factory.getPair(fixedToken0, fixedToken1);
        if (poolAddress === ethers.ZeroAddress) continue;

        const fixedPoolAddress = normalizeAddress(poolAddress);
        if (!fixedPoolAddress) {
          console.warn("Invalid pool address returned from factory. Skipping.");
          continue;
        }

        console.log(`Checking Aerodrome NFT positions for pool ${fixedPoolAddress}`);

        // Create pool contract with normalized address
        const pool = new ethers.Contract(fixedPoolAddress, POOL_ABI, provider);

        // Check LP balance before proceeding
        const balance = await pool.balanceOf(fixedWalletAddress);
        if (balance.isZero()) {
          console.log("No LP tokens found for this wallet in Aerodrome pool.");
          continue;
        }

        const nftPosition = await checkLPNFTPosition(
          provider,
          DEX_ADDRESSES.aerodrome.positionManager,
          fixedPoolAddress,
          fixedWalletAddress
        );

        let priceRange = undefined;
        let isNFT = false;
        if (nftPosition) {
          priceRange = getPositionPriceRange(nftPosition);
          isNFT = true;
          console.log('Found NFT position with price range:', priceRange);
        }

        // Create token contracts with normalized addresses
        const [token0Contract, token1Contract] = [
          new ethers.Contract(fixedToken0, ERC20_ABI, provider),
          new ethers.Contract(fixedToken1, ERC20_ABI, provider)
        ];

        const [symbol0, symbol1, decimals0, decimals1, reserves, slot0] = await Promise.all([
          token0Contract.symbol(),
          token1Contract.symbol(),
          token0Contract.decimals(),
          token1Contract.decimals(),
          pool.getReserves(),
          pool.slot0()
        ]);

        // Fetch prices using normalized addresses
        const [token0Price, token1Price] = await Promise.all([
          getTokenPrice(provider, symbol0, fixedToken0),
          getTokenPrice(provider, symbol1, fixedToken1)
        ]);

        if (token0Price === 0 || token1Price === 0) {
          console.warn(`Skipping pool due to missing price data: ${symbol0}/${symbol1}`);
          continue;
        }

        const reserve0 = Number(ethers.formatUnits(reserves[0], decimals0));
        const reserve1 = Number(ethers.formatUnits(reserves[1], decimals1));
        const currentTick = slot0[1];

        const tvl = (reserve0 * token0Price) + (reserve1 * token1Price);
        const volume24h = tvl * 0.08; // This should be fetched from an API in production
        const apr = calculateAPR(volume24h, tvl, 0.3);

        const currentPrice = tickToPrice(currentTick, decimals0, decimals1);

        pools.push({
          id: fixedPoolAddress,
          protocol: 'Aerodrome',
          token0Symbol: symbol0,
          token1Symbol: symbol1,
          tvl: tvl.toString(),
          apr: apr.toFixed(2),
          volume24h: volume24h.toString(),
          fee: 0.3,
          isNFT,
          priceRange: priceRange || {
            lower: (currentPrice * 0.8).toString(),
            upper: (currentPrice * 1.2).toString()
          },
          token0Address: pair.token0, // Added token addresses
          token1Address: pair.token1 // Added token addresses
        });

      } catch (error) {
        console.error(`Error processing Aerodrome pair:`, error);
        continue;
      }
    }

    return pools;
  } catch (error) {
    console.error('Error scanning Aerodrome pools:', error);
    return [];
  }
}

function calculateAPR(volume24h: number, tvl: number, feePercent: number): number {
  if (tvl === 0) return 0;
  const dailyFeeRevenue = volume24h * (feePercent / 100);
  const annualizedFeeRevenue = dailyFeeRevenue * 365;
  return (annualizedFeeRevenue / tvl) * 100;
}