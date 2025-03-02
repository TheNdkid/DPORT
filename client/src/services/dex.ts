import { ethers } from 'ethers';
import { normalizeAddress } from '@shared/utils/address';
import { getTokenPrice } from '@shared/services/price-feed';
import { formatTokenAmount } from '@/lib/formatting';
import { TOKEN_ADDRESSES, DEX_ADDRESSES } from '../constants/addresses';

const FACTORY_ABI = [
  'function getPair(address tokenA, address tokenB) external view returns (address pair)',
  'function allPairsLength() external view returns (uint256)',
  'function allPairs(uint256) external view returns (address pair)',
];

const POOL_ABI = [
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function balanceOf(address owner) external view returns (uint256)',
];

const ERC20_ABI = [
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function decimals() external view returns (uint8)',
  'function balanceOf(address owner) external view returns (uint256)',
];

const VOTER_ABI = [
  'function gauges(address) view returns (address)',
  'function poolForGauge(address) view returns (address)',
];

const GAUGE_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function earned(address) view returns (uint256)',
];

const POOL_ABI_ORIGINAL = [
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function symbol() view returns (string)',
  'function balanceOf(address) view returns (uint256)',
  'function getReserves() view returns (uint112, uint112, uint32)',
];

const ERC20_ABI_ORIGINAL = [
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
];

const POSITION_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
];

async function fetchTopPools(provider: ethers.JsonRpcProvider, dexName: string) {
  const dexAddresses = DEX_ADDRESSES[dexName as keyof typeof DEX_ADDRESSES];
  if (!dexAddresses || !dexAddresses.factory) {
    console.error(`No factory address found for DEX: ${dexName}`);
    throw new Error(`Unknown or incomplete DEX configuration: ${dexName}`);
  }

  const factory = new ethers.Contract(dexAddresses.factory, FACTORY_ABI, provider);
  const pairCount = await factory.allPairsLength();

  const fetchLimit = Math.min(Number(pairCount), 20);
  const pools = [];

  for (let i = 0; i < fetchLimit; i++) {
    try {
      const pairAddress = await factory.allPairs(i);
      const pool = new ethers.Contract(pairAddress, POOL_ABI, provider);

      const [token0Address, token1Address] = await Promise.all([pool.token0(), pool.token1()]);
      const token0 = new ethers.Contract(token0Address, ERC20_ABI, provider);
      const token1 = new ethers.Contract(token1Address, ERC20_ABI, provider);

      const [token0Symbol, token1Symbol, reserves] = await Promise.all([
        token0.symbol(),
        token1.symbol(),
        pool.getReserves(),
      ]);

      pools.push({
        address: pairAddress,
        token0: token0Address,
        token1: token1Address,
        token0Symbol,
        token1Symbol,
        reserve0: reserves[0],
        reserve1: reserves[1],
        dex: dexName,
      });
    } catch (error) {
      console.error(`Error fetching pool at index ${i} for ${dexName}:`, error.message);
    }
  }

  return pools;
}

async function getUserPoolPositions(provider: ethers.JsonRpcProvider, walletAddress: string, pools: any[]) {
  const positions = [];
  for (const pool of pools) {
    try {
      const poolContract = new ethers.Contract(pool.address, POOL_ABI, provider);
      const balance = await poolContract.balanceOf(walletAddress);

      if (Number(balance) > 0) {
        positions.push({ ...pool, balance });
      }
    } catch (error) {
      console.error(`Error checking position for pool ${pool.address}:`, error.message);
    }
  }
  return positions;
}

async function getTokenValue(
  provider: ethers.JsonRpcProvider,
  tokenAddress: string,
  amount: bigint,
  priceFeeds: Record<string, string>,
) {
  try {
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const [symbol, decimals] = await Promise.all([token.symbol(), token.decimals()]);

    if (priceFeeds[symbol]) {
      const priceFeedAddress = priceFeeds[symbol];
      const priceFeedAbi = [
        'function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
      ];
      const priceFeed = new ethers.Contract(priceFeedAddress, priceFeedAbi, provider);
      const roundData = await priceFeed.latestRoundData();
      const price = Number(roundData.answer) / 10 ** 8;
      const adjustedAmount = Number(amount) / 10 ** decimals;
      return {
        token: { address: tokenAddress, symbol, decimals },
        amount,
        value: adjustedAmount * price,
      };
    }

    if (['USDC', 'USDbC', 'USDT', 'DAI'].includes(symbol)) {
      return {
        token: { address: tokenAddress, symbol, decimals },
        amount,
        value: Number(amount) / 10 ** decimals,
      };
    }

    return {
      token: { address: tokenAddress, symbol, decimals },
      amount,
      value: null,
    };
  } catch (error) {
    console.error(`Error calculating token value for ${tokenAddress}:`, error.message);
    return null;
  }
}

async function fetchAerodromePositions(provider: ethers.JsonRpcProvider, walletAddress: string): Promise<Position[]> {
  console.log(`Fetching Aerodrome positions for wallet: ${walletAddress}`);
  const positions: Position[] = [];
  const voter = new ethers.Contract(DEX_ADDRESSES.aerodrome.voter, VOTER_ABI, provider);

  const testPools = [
    '0x4C36388bE6F416A29C8d8Eee81C771cE6bE14B18',
    '0x7D49E5faB7e31Ddf822a759EBc29C8009D535E06',
  ];

  for (const poolAddress of testPools) {
    try {
      const normalizedPoolAddress = normalizeAddress(poolAddress);
      if (!normalizedPoolAddress) continue;

      const gaugeAddress = await voter.gauges(normalizedPoolAddress);
      if (gaugeAddress === ethers.ZeroAddress) {
        console.log(`No gauge for pool ${normalizedPoolAddress}`);
        continue;
      }

      const gauge = new ethers.Contract(gaugeAddress, GAUGE_ABI, provider);
      const normalizedWalletAddress = normalizeAddress(walletAddress);
      if (!normalizedWalletAddress) continue;

      const stakedBalance = await gauge.balanceOf(normalizedWalletAddress);
      if (Number(stakedBalance) === 0) {
        console.log(`No staked balance in gauge ${gaugeAddress}`);
        continue;
      }

      const pool = new ethers.Contract(normalizedPoolAddress, POOL_ABI_ORIGINAL, provider);
      const [token0Address, token1Address] = await Promise.all([pool.token0(), pool.token1()]);
      const token0 = new ethers.Contract(token0Address, ERC20_ABI_ORIGINAL, provider);
      const token1 = new ethers.Contract(token1Address, ERC20_ABI_ORIGINAL, provider);

      const [token0Symbol, token1Symbol, token0Decimals, token1Decimals, reserves] = await Promise.all([
        token0.symbol(),
        token1.symbol(),
        token0.decimals(),
        token1.decimals(),
        pool.getReserves(),
      ]);

      const token0Price = (await getTokenPrice(provider, token0Symbol, token0Address)) || 0;
      const token1Price = (await getTokenPrice(provider, token1Symbol, token1Address)) || 0;

      const reserve0 = Number(reserves[0]) / 10 ** token0Decimals;
      const reserve1 = Number(reserves[1]) / 10 ** token1Decimals;
      const totalLiquidity = reserve0 * token0Price + reserve1 * token1Price;
      const poolBalance = await pool.balanceOf(ethers.ZeroAddress);
      const userShare = Number(stakedBalance) / Number(poolBalance);
      const userValue = totalLiquidity * userShare;

      const earned = await gauge.earned(normalizedWalletAddress);

      positions.push({
        id: `aerodrome-staked-${normalizedPoolAddress}`,
        protocol: 'Aerodrome',
        poolAddress: normalizedPoolAddress,
        gaugeAddress,
        tokenSymbol0: token0Symbol,
        tokenSymbol1: token1Symbol,
        tokenAddress0: token0Address,
        tokenAddress1: token1Address,
        stakedAmount: ethers.formatUnits(stakedBalance, 18),
        tokenAmount0: (reserve0 * userShare).toString(),
        tokenAmount1: (reserve1 * userShare).toString(),
        valueUSD: userValue.toFixed(2),
        earnedRewards: ethers.formatUnits(earned, 18),
        type: 'staked',
        source: 'aerodrome',
        token0: token0Address,
        token1: token1Address,
        token0Symbol: token0Symbol,
        token1Symbol: token1Symbol,
      });
    } catch (error) {
      console.error(`Error processing pool ${poolAddress}:`, error.message);
    }
  }
  return positions;
}

async function fetchUniswapV3Positions(provider: ethers.JsonRpcProvider, walletAddress: string): Promise<Position[]> {
  console.log(`Fetching Uniswap V3 positions for wallet: ${walletAddress}`);
  try {
    const uniswapContract = new ethers.Contract(DEX_ADDRESSES.uniswap.positionManager, POSITION_ABI, provider);
    const balance = await retryRpcCall(() => uniswapContract.balanceOf(walletAddress));
    console.log(`Uniswap V3 Balance: ${balance.toString()}`);

    if (Number(balance) === 0) {
      return [];
    }

    const positionCount = Number(balance);
    console.log(`Found ${positionCount} Uniswap V3 positions`);
    const positions: Position[] = [];
    for (let i = 0; i < positionCount; i++) {
      try {
        const tokenId = await retryRpcCall(() => uniswapContract.tokenOfOwnerByIndex(walletAddress, i));
        const positionData = await retryRpcCall(() => uniswapContract.positions(tokenId));
        console.log(`Fetched position data for tokenId ${tokenId.toString()}:`, positionData);

        const token0Contract = new ethers.Contract(positionData.token0, ERC20_ABI, provider);
        const token1Contract = new ethers.Contract(positionData.token1, ERC20_ABI, provider);
        const [token0Symbol, token1Symbol, token0Decimals, token1Decimals] = await Promise.all([
          token0Contract.symbol(),
          token1Contract.symbol(),
          token0Contract.decimals(),
          token1Contract.decimals(),
        ]);

        const token0Price = (await getTokenPrice(provider, token0Symbol, positionData.token0)) || 0;
        const token1Price = (await getTokenPrice(provider, token1Symbol, positionData.token1)) || 0;

        const valueUSD = (
          token0Price * Number(ethers.formatUnits(positionData.tokensOwed0, token0Decimals)) +
          token1Price * Number(ethers.formatUnits(positionData.tokensOwed1, token1Decimals))
        ).toFixed(2);

        positions.push({
          id: `uniswap-v3-${tokenId.toString()}`,
          protocol: 'Uniswap V3',
          token0: positionData.token0,
          token1: positionData.token1,
          token0Symbol,
          token1Symbol,
          tokenAddress0: positionData.token0,
          tokenAddress1: positionData.token1,
          liquidity: ethers.formatUnits(positionData.liquidity, 18),
          fee: positionData.fee.toString(),
          tickLower: positionData.tickLower,
          tickUpper: positionData.tickUpper,
          type: 'concentrated',
          source: 'uniswap-v3',
          valueUSD,
          stakedAmount: '0',
          earnedRewards: '0',
        });
      } catch (error) {
        console.error(`Error processing Uniswap V3 position at index ${i}:`, error.message);
      }
    }
    return positions;
  } catch (error) {
    console.error('Error fetching Uniswap V3 positions:', error.message);
    return [];
  }
}

async function fetchSlipstreamPositions(provider: ethers.JsonRpcProvider, walletAddress: string): Promise<Position[]> {
  console.log(`Fetching Slipstream positions for wallet: ${walletAddress}`);
  try {
    const slipstreamContract = new ethers.Contract(
      DEX_ADDRESSES.aerodrome.slipstreamPositionManager,
      POSITION_ABI,
      provider
    );
    const balance = await retryRpcCall(() => slipstreamContract.balanceOf(walletAddress));
    console.log(`Slipstream Balance: ${balance.toString()}`);

    if (Number(balance) === 0) {
      return [];
    }

    const positionCount = Number(balance);
    console.log(`Found ${positionCount} Slipstream positions`);
    const positions: Position[] = [];
    for (let i = 0; i < positionCount; i++) {
      try {
        const tokenId = await retryRpcCall(() => slipstreamContract.tokenOfOwnerByIndex(walletAddress, i));
        const positionData = await retryRpcCall(() => slipstreamContract.positions(tokenId));
        console.log(`Fetched position data for tokenId ${tokenId.toString()}:`, positionData);

        const token0Contract = new ethers.Contract(positionData.token0, ERC20_ABI, provider);
        const token1Contract = new ethers.Contract(positionData.token1, ERC20_ABI, provider);
        const [token0Symbol, token1Symbol, token0Decimals, token1Decimals] = await Promise.all([
          token0Contract.symbol(),
          token1Contract.symbol(),
          token0Contract.decimals(),
          token1Contract.decimals(),
        ]);

        const token0Price = (await getTokenPrice(provider, token0Symbol, positionData.token0)) || 0;
        const token1Price = (await getTokenPrice(provider, token1Symbol, positionData.token1)) || 0;

        const valueUSD = (
          token0Price * Number(ethers.formatUnits(positionData.tokensOwed0, token0Decimals)) +
          token1Price * Number(ethers.formatUnits(positionData.tokensOwed1, token1Decimals))
        ).toFixed(2);

        positions.push({
          id: `slipstream-${tokenId.toString()}`,
          protocol: 'Aerodrome Slipstream',
          token0: positionData.token0,
          token1: positionData.token1,
          token0Symbol,
          token1Symbol,
          tokenAddress0: positionData.token0,
          tokenAddress1: positionData.token1,
          liquidity: ethers.formatUnits(positionData.liquidity, 18),
          fee: positionData.fee.toString(),
          tickLower: positionData.tickLower,
          tickUpper: positionData.tickUpper,
          type: 'concentrated',
          source: 'slipstream',
          valueUSD,
          stakedAmount: '0',
          earnedRewards: '0',
        });
      } catch (error) {
        console.error(`Error processing Slipstream position at index ${i}:`, error.message);
        throw error;
      }
    }
    return positions;
  } catch (error) {
    console.error('Error fetching Slipstream positions:', error.message);
    return [];
  }
}

async function fetchAllPositions(walletAddress: string) {
  if (typeof walletAddress !== 'string') {
    console.error('Invalid walletAddress: expected a string, got:', walletAddress);
    throw new Error('walletAddress must be a string');
  }

  console.log(`Fetching all positions for wallet: ${walletAddress}`);
  if (!walletAddress) {
    console.warn('No wallet address provided');
    return { aerodrome: [], uniswap: [], slipstream: [] };
  }

  try {
    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
    const [aerodromePositions, uniswapPositions, slipstreamPositions] = await Promise.all([
      fetchAerodromePositions(provider, walletAddress),
      fetchUniswapV3Positions(provider, walletAddress),
      fetchSlipstreamPositions(provider, walletAddress),
    ]);

    return {
      aerodrome: aerodromePositions,
      uniswap: uniswapPositions,
      slipstream: slipstreamPositions,
    };
  } catch (error) {
    console.error('Error fetching all positions:', error.message || error);
    return { aerodrome: [], uniswap: [], slipstream: [] };
  }
}

async function fetchTokenBalance(tokenAddress: string, walletAddress: string) {
  const effectiveProvider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  try {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, effectiveProvider);
    const [balance, symbol, decimals] = await Promise.all([
      tokenContract.balanceOf(walletAddress),
      tokenContract.symbol(),
      tokenContract.decimals(),
    ]);
    const formattedBalance = formatTokenAmount(balance, decimals);
    return {
      address: tokenAddress,
      symbol,
      balance: formattedBalance,
      decimals,
      rawBalance: balance,
    };
  } catch (error) {
    console.error(`Error fetching token balance for ${tokenAddress}:`, error.message);
    return {
      address: tokenAddress,
      symbol: 'Unknown',
      balance: '0',
      decimals: 18,
      rawBalance: ethers.BigNumber.from(0),
    };
  }
}

async function scanTokenBalances(walletAddress: string) {
  console.log('Scanning assets for address:', walletAddress);
  try {
    const tokenPromises = Object.entries(TOKEN_ADDRESSES).map(async ([name, address]) => {
      const token = await fetchTokenBalance(address, walletAddress);
      return { ...token, name };
    });
    const tokens = await Promise.all(tokenPromises);
    return tokens.filter(token => parseFloat(token.balance) > 0);
  } catch (error) {
    console.error('Error scanning token balances:', error.message);
    return [];
  }
}

const DEX_ADDRESSES_UPDATED = DEX_ADDRESSES;

interface Position {
  id: string;
  protocol: string;
  poolAddress?: string;
  token0: string;
  token1: string;
  token0Symbol: string;
  token1Symbol: string;
  liquidity?: string;
  fee?: string;
  tickLower?: number;
  tickUpper?: number;
  priceLower?: string;
  priceUpper?: string;
  type: string;
  source: string;
  gaugeAddress?: string;
  tokenSymbol0?: string;
  tokenSymbol1?: string;
  tokenAddress0?: string;
  tokenAddress1?: string;
  stakedAmount?: string;
  tokenAmount0?: string;
  tokenAmount1?: string;
  valueUSD?: string;
  earnedRewards?: string;
}

function getPositionDescription(position: any) {
  if (!position || !position.metadata) return 'Unknown Position';
  const { metadata } = position;
  if (metadata.name) return metadata.name;
  if (metadata.description) {
    const lines = metadata.description.split('\n');
    const poolLine = lines.find(line => line.includes('Pool Address:'));
    const tokensLine = lines.find(line => line.includes('/'));
    if (tokensLine) return tokensLine;
    if (poolLine) return `Pool: ${poolLine.split('Pool Address:')[1].trim()}`;
  }
  return `Position #${position.id}`;
}

function getPositionDetails(position: any) {
  if (!position || !position.metadata) return [];
  const { metadata } = position;
  if (metadata.description) {
    const lines = metadata.description.split('\n').filter(line => line.trim() !== '');
    return lines.map(line => {
      const parts = line.split(':');
      if (parts.length > 1) {
        return { label: parts[0].trim(), value: parts.slice(1).join(':').trim() };
      }
      return { label: '', value: line.trim() };
    });
  }
  return [];
}

function getPositionImageUrl(position: any) {
  if (!position || !position.metadata) return null;
  const { metadata } = position;
  if (metadata.image) {
    if (metadata.image.startsWith('data:')) return metadata.image;
    if (metadata.image.startsWith('ipfs://')) {
      const ipfsHash = metadata.image.replace('ipfs://', '');
      return `https://ipfs.io/ipfs/${ipfsHash}`;
    }
    return metadata.image;
  }
  return null;
}

function getPositionPriceRange(position: any) {
  if (!position || !position.metadata) return { min: 0, max: 0 };
  const { metadata } = position;
  if (metadata.name) {
    const priceRangeMatch = metadata.name.match(/(\d+\.?\d*)<>(\d+\.?\d*)/);
    if (priceRangeMatch) {
      return { min: parseFloat(priceRangeMatch[1]), max: parseFloat(priceRangeMatch[2]) };
    }
  }
  if (metadata.description) {
    const priceRangeMatch = metadata.description.match(/(\d+\.?\d*)<>(\d+\.?\d*)/);
    if (priceRangeMatch) {
      return { min: parseFloat(priceRangeMatch[1]), max: parseFloat(priceRangeMatch[2]) };
    }
    const lowerTickMatch = metadata.description.match(/lowerTick:\s*(-?\d+)/);
    const upperTickMatch = metadata.description.match(/upperTick:\s*(-?\d+)/);
    if (lowerTickMatch && upperTickMatch) {
      const lowerTick = parseInt(lowerTickMatch[1]);
      const upperTick = parseInt(upperTickMatch[1]);
      const minPrice = Math.pow(1.0001, lowerTick);
      const maxPrice = Math.pow(1.0001, upperTick);
      return { min: minPrice, max: maxPrice };
    }
  }
  return { min: 0, max: 0 };
}

async function retryRpcCall(fn: () => Promise<any>, maxRetries = 3, initialDelay = 1000) {
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.warn(`RPC call failed (attempt ${attempt + 1}/${maxRetries}):`, error.message);
      const delay = initialDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

export {
  fetchTopPools,
  getUserPoolPositions,
  getTokenValue,
  fetchAerodromePositions,
  fetchUniswapV3Positions,
  fetchSlipstreamPositions,
  fetchAllPositions,
  fetchTokenBalance,
  scanTokenBalances,
  getPositionDescription,
  getPositionDetails,
  getPositionImageUrl,
  getPositionPriceRange,
  retryRpcCall,
  DEX_ADDRESSES_UPDATED as DEX_ADDRESSES,
};