import { ethers } from 'ethers';
import { formatTokenAmount } from '../lib/formatting';

// Aerodrome contracts on Base
const VOTER_ADDRESS = '0x17E2B74295d92F8B21b36EC0D3491B63e3c78d0F';
const FACTORY_ADDRESS = '0x420DD381b31aEf6683db6B902084cB0FFECe40Da';

// ABIs
const VOTER_ABI = [
  'function gauges(address) view returns (address)',
  'function isAlive(address) view returns (bool)',
  'function poolForGauge(address) view returns (address)',
  'function pools(uint256) view returns (address)'
];

const GAUGE_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function earned(address) view returns (uint256)',
  'function token() view returns (address)'
];

const POOL_ABI = [
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function getReserves() view returns (uint112, uint112, uint32)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)'
];

const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)'
];

// Provider (will be passed in from the calling function)
let provider;

export async function initAerodrome(ethersProvider) {
  provider = ethersProvider;
}

export async function fetchGaugePosition(walletAddress, poolAddress) {
  try {
    if (!provider || !walletAddress || !poolAddress) {
      console.error('Missing required parameters for fetchGaugePosition');
      return null;
    }

    const voterContract = new ethers.Contract(VOTER_ADDRESS, VOTER_ABI, provider);

    // Get gauge for the pool
    const gaugeAddress = await voterContract.gauges(poolAddress);

    if (!gaugeAddress || gaugeAddress === ethers.ZeroAddress) {
      console.log(`No gauge found for pool ${poolAddress}`);
      return null;
    }

    // Check if gauge is alive
    const isAlive = await voterContract.isAlive(gaugeAddress);
    if (!isAlive) {
      console.log(`Gauge ${gaugeAddress} is not alive`);
      return null;
    }

    const gaugeContract = new ethers.Contract(gaugeAddress, GAUGE_ABI, provider);

    // Get user's staked balance
    const stakedBalance = await gaugeContract.balanceOf(walletAddress);

    if (stakedBalance == 0) {
      console.log(`No staked balance for wallet ${walletAddress} in gauge ${gaugeAddress}`);
      return null;
    }

    // Get earned rewards
    const earnedRewards = await gaugeContract.earned(walletAddress);

    // Get LP token (from gauge token)
    const lpTokenAddress = await gaugeContract.token();

    const poolContract = new ethers.Contract(poolAddress, POOL_ABI, provider);

    // Get tokens in the pool
    const [token0Address, token1Address] = await Promise.all([
      poolContract.token0(),
      poolContract.token1()
    ]);

    const token0Contract = new ethers.Contract(token0Address, ERC20_ABI, provider);
    const token1Contract = new ethers.Contract(token1Address, ERC20_ABI, provider);

    // Get token details
    const [
      token0Symbol, token0Decimals,
      token1Symbol, token1Decimals,
      poolReserves, poolTotalSupply
    ] = await Promise.all([
      token0Contract.symbol(),
      token0Contract.decimals(),
      token1Contract.symbol(),
      token1Contract.decimals(),
      poolContract.getReserves(),
      poolContract.totalSupply()
    ]);

    // Calculate position value
    const [reserve0, reserve1] = poolReserves;
    const stakedShare = stakedBalance * BigInt(1e18) / poolTotalSupply;

    const token0Amount = (reserve0 * stakedShare) / BigInt(1e18);
    const token1Amount = (reserve1 * stakedShare) / BigInt(1e18);

    return {
      poolAddress,
      gaugeAddress,
      lpTokenAddress,
      stakedBalance: stakedBalance.toString(),
      earnedRewards: earnedRewards.toString(),
      token0: {
        address: token0Address,
        symbol: token0Symbol,
        decimals: token0Decimals,
        amount: formatTokenAmount(token0Amount, token0Decimals)
      },
      token1: {
        address: token1Address,
        symbol: token1Symbol,
        decimals: token1Decimals,
        amount: formatTokenAmount(token1Amount, token1Decimals)
      }
    };
  } catch (error) {
    console.error(`Error fetching gauge position for ${poolAddress}:`, error);
    return null;
  }
}

export async function fetchAllAerodromePositions(walletAddress) {
  try {
    if (!provider || !walletAddress) {
      console.error('Missing required parameters for fetchAllAerodromePositions');
      return [];
    }

    const voterContract = new ethers.Contract(VOTER_ADDRESS, VOTER_ABI, provider);

    // Get list of all pools
    let poolIndex = 0;
    const pools = [];

    // Fetch a reasonable number of pools (adjust as needed)
    while (poolIndex < 100) {
      try {
        const poolAddress = await voterContract.pools(poolIndex);
        if (poolAddress === ethers.ZeroAddress) break;

        pools.push(poolAddress);
        poolIndex++;
      } catch (error) {
        console.log(`Reached end of pools at index ${poolIndex}`);
        break;
      }
    }

    console.log(`Found ${pools.length} pools`);

    // For each pool, check if user has a gauge position
    const positionPromises = pools.map(poolAddress => 
      fetchGaugePosition(walletAddress, poolAddress)
    );

    const positions = await Promise.all(positionPromises);

    // Filter out null positions (where user has no stake)
    return positions.filter(position => position !== null);
  } catch (error) {
    console.error('Error fetching all Aerodrome positions:', error);
    return [];
  }
}

// Helper function to get a pool's liquidity (not staked in gauge)
export async function fetchPoolLiquidity(walletAddress, poolAddress) {
  try {
    if (!provider || !walletAddress || !poolAddress) {
      console.error('Missing required parameters for fetchPoolLiquidity');
      return null;
    }

    const poolContract = new ethers.Contract(poolAddress, POOL_ABI, provider);

    // Get user's LP balance
    const lpBalance = await poolContract.balanceOf(walletAddress);

    if (lpBalance == 0) {
      return null;
    }

    // Get tokens in the pool
    const [token0Address, token1Address] = await Promise.all([
      poolContract.token0(),
      poolContract.token1()
    ]);

    const token0Contract = new ethers.Contract(token0Address, ERC20_ABI, provider);
    const token1Contract = new ethers.Contract(token1Address, ERC20_ABI, provider);

    // Get token details
    const [
      token0Symbol, token0Decimals,
      token1Symbol, token1Decimals,
      poolReserves, poolTotalSupply
    ] = await Promise.all([
      token0Contract.symbol(),
      token0Contract.decimals(),
      token1Contract.symbol(),
      token1Contract.decimals(),
      poolContract.getReserves(),
      poolContract.totalSupply()
    ]);

    // Calculate position value
    const [reserve0, reserve1] = poolReserves;
    const lpShare = lpBalance * BigInt(1e18) / poolTotalSupply;

    const token0Amount = (reserve0 * lpShare) / BigInt(1e18);
    const token1Amount = (reserve1 * lpShare) / BigInt(1e18);

    return {
      poolAddress,
      type: 'unstaked',
      lpBalance: lpBalance.toString(),
      token0: {
        address: token0Address,
        symbol: token0Symbol,
        decimals: token0Decimals,
        amount: formatTokenAmount(token0Amount, token0Decimals)
      },
      token1: {
        address: token1Address,
        symbol: token1Symbol,
        decimals: token1Decimals,
        amount: formatTokenAmount(token1Amount, token1Decimals)
      }
    };
  } catch (error) {
    console.error(`Error fetching pool liquidity for ${poolAddress}:`, error);
    return null;
  }
}

// Common token addresses on Base network (reused from original if needed)
const TOKEN_ADDRESSES = {
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': 'USDC',
  '0x4200000000000000000000000000000000000006': 'ETH',
  '0x50c5725949a6f0c72e6c4a641f24049a917db0cb': 'DAI',
  '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca': 'USDbC',
  '0x2ae3f1ec7f1f5012cfc6c13c20c163c6969c28f2': 'cbETH',
  '0xb6fe221fe9eef5aba221c348ba20a1bf5e73624c': 'BALD'
};

// Helper function to safely check if a BigNumber is zero (reused from original)
function isBigNumberZero(value: ethers.BigNumberish): boolean {
  try {
    return ethers.toBigInt(value) === 0n;
  } catch (e) {
    // If conversion fails, try string comparison as fallback
    return value.toString() === '0';
  }
}

//The functions below are removed because the edited code provides a replacement
// export async function fetchAerodromePositionsOld(provider: ethers.JsonRpcProvider, address: string) {
//     return []
// }

// export async function fetchAerodromePositions(provider: ethers.JsonRpcProvider, walletAddress: string): Promise<AerodromePosition[]> {
//   //Removed
// }

// export async function fetchSlipstreamPositions(provider: ethers.JsonRpcProvider, managerAddress: string, walletAddress: string): Promise<AerodromePosition[]> {
//   //Removed
// }


//Removed old ABIs and interfaces
// const SLIPSTREAM_ABI = [ ... ];
// const LP_TOKEN_ABI = [ ... ];
// const VOTER_ABI_OLD = [ ... ];
// const GAUGE_ABI_OLD = [ ... ];
// const POOL_ABI = [ ... ];
// const AERODROME_NFT_ABI = [ ... ];
// export interface AerodromePosition { ... }
// export interface AerodromePositionOld { ... }
// interface NFTPosition { ... }
// export async function parseSlipstreamMetadata(metadata: any): Promise<{ ... }> { ... }
// async function storePosition(position: AerodromePosition, walletAddress: string) { ... }
// async function fetchGaugeRewards(gaugeContract: ethers.Contract, userAddress: string, userBalance: bigint): Promise<{ ... }> { ... }
// async function calculateAerodromePositionValue(provider: ethers.JsonRpcProvider, position: AerodromePositionOld): Promise<{ ... } | null> { ... }
// async function fetchAerodromeNFTPosition(provider: ethers.JsonRpcProvider, nftContractAddress: string, tokenId: string, walletAddress: string): Promise<NFTPosition | null> { ... }
// import { db } from '../lib/db';
// import { liquidityPositions, liquidityPools } from '../../shared/schema';
// import { eq } from 'drizzle-orm';
// const slipstreamAddress = "0x827922686190790b37229fd06084350E74485b72";
// const alternateAddresses = [ ... ];