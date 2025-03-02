typescript

import { ethers } from 'ethers';
import { formatTokenAmount } from '@/lib/formatting';

const POSITION_MANAGER_ABI = [
  'function balanceOf(address owner) external view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)',
  'function ownerOf(uint256 tokenId) external view returns (address)',
  'function positions(uint256 tokenId) external view returns (uint96 nonce, address operator, address token0, address token1, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)'
];

export interface NFTPosition {
  tokenId: string;
  token0: string;
  token1: string;
  token0Decimals: number;
  token1Decimals: number;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  tokensOwed0: string;
  tokensOwed1: string;
}

export async function checkLPNFTPosition(
  provider: ethers.JsonRpcProvider,
  positionManagerAddress: string,
  poolAddress: string,
  walletAddress: string
): Promise<NFTPosition | null> {
  if (!ethers.isAddress(positionManagerAddress) || !ethers.isAddress(poolAddress) || !ethers.isAddress(walletAddress)) {
    console.warn('Invalid address provided:', { positionManagerAddress, poolAddress, walletAddress });
    return null;
  }

  try {
    console.debug('Starting NFT position check:', {
      positionManager: positionManagerAddress,
      pool: poolAddress,
      wallet: walletAddress
    });

    const nftInterface = new ethers.Interface(POSITION_MANAGER_ABI);
    const balanceData = nftInterface.encodeFunctionData('balanceOf', [walletAddress]);

    const balanceResult = await provider.call({
      to: positionManagerAddress,
      data: balanceData
    });

    if (!balanceResult || balanceResult === '0x') {
      console.warn('No balance data returned');
      return null;
    }

    const balance = ethers.toBigInt(balanceResult);
    console.debug('NFT balance result:', balance.toString());

    if (balance === 0n) {
      console.debug('No NFT positions found for wallet');
      return null;
    }

    const poolContract = new ethers.Contract(
      poolAddress,
      [
        'function token0() view returns (address)',
        'function token1() view returns (address)',
        'function decimals0() view returns (uint8)',
        'function decimals1() view returns (uint8)'
      ],
      provider
    );

    const [poolToken0, poolToken1, decimals0, decimals1] = await Promise.all([
      poolContract.token0().catch(() => null),
      poolContract.token1().catch(() => null),
      poolContract.decimals0().catch(() => 18),
      poolContract.decimals1().catch(() => 18)
    ]);

    if (!poolToken0 || !poolToken1) {
      console.warn('Failed to fetch pool tokens');
      return null;
    }

    for (let i = 0; i < Number(balance); i++) {
      try {
        const tokenIndexData = nftInterface.encodeFunctionData('tokenOfOwnerByIndex', [walletAddress, i]);
        const tokenIndexResult = await provider.call({
          to: positionManagerAddress,
          data: tokenIndexData
        });

        if (!tokenIndexResult || tokenIndexResult === '0x') {
          console.warn(`No token ID data returned at index ${i}`);
          continue;
        }

        const tokenId = ethers.toBigInt(tokenIndexResult);
        console.debug(`Checking position ${i + 1}/${balance}, Token ID: ${tokenId}`);

        const positionData = nftInterface.encodeFunctionData('positions', [tokenId]);
        const positionResult = await provider.call({
          to: positionManagerAddress,
          data: positionData
        });

        if (!positionResult || positionResult === '0x') {
          console.warn('No position data returned');
          continue;
        }

        const position = nftInterface.decodeFunctionResult('positions', positionResult)[0];

        if (
          !position ||
          !position.token0 ||
          !position.token1 ||
          !ethers.isAddress(position.token0) ||
          !ethers.isAddress(position.token1)
        ) {
          console.warn('Invalid position data:', position);
          continue;
        }

        if (
          (position.token0.toLowerCase() === poolToken0.toLowerCase() &&
           position.token1.toLowerCase() === poolToken1.toLowerCase()) ||
          (position.token0.toLowerCase() === poolToken1.toLowerCase() &&
           position.token1.toLowerCase() === poolToken0.toLowerCase())
        ) {
          return {
            tokenId: tokenId.toString(),
            token0: position.token0,
            token1: position.token1,
            token0Decimals: Number(decimals0),
            token1Decimals: Number(decimals1),
            tickLower: Number(position.tickLower),
            tickUpper: Number(position.tickUpper),
            liquidity: position.liquidity.toString(),
            tokensOwed0: position.tokensOwed0.toString(),
            tokensOwed1: position.tokensOwed1.toString()
          };
        }
      } catch (error) {
        console.warn(`Error checking position ${i}:`, error);
        continue;
      }
    }

    console.debug('No matching NFT positions found for this pool');
    return null;
  } catch (error) {
    console.error('Error checking LP NFT positions:', error);
    return null;
  }
}

export function calculatePriceFromTick(tick: number, decimals0: number, decimals1: number): number {
  const price = 1.0001 ** tick;
  return price * (10 ** (decimals1 - decimals0));
}

export function formatPrice(price: number): string {
  if (price < 0.0001) return '< 0.0001';
  if (price < 1) return price.toPrecision(4);
  if (price < 1000000) return price.toFixed(2);
  return price.toExponential(2);
}

export function getPositionPriceRange(position: NFTPosition): {
  lower: string;
  upper: string;
} {
  const lowerPrice = calculatePriceFromTick(position.tickLower, position.token0Decimals, position.token1Decimals);
  const upperPrice = calculatePriceFromTick(position.tickUpper, position.token0Decimals, position.token1Decimals);

  return {
    lower: formatPrice(lowerPrice),
    upper: formatPrice(upperPrice)
  };
}