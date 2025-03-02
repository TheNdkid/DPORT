import { ethers } from 'ethers';
import { normalizeAddress, isValidAddress } from '@shared/utils/address';

const RATE_LIMIT_DELAY = 100; // ms between RPC calls
const MAX_RETRIES = 3;

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)'
];

const ERC721_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function supportsInterface(bytes4 interfaceId) view returns (bool)'
];

const UNISWAP_V3_POSITION_NFT_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function positions(uint256 tokenId) view returns (address token0, address token1, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 tokensOwed0, uint256 tokensOwed1)',
  'function symbol() view returns (string)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)'
];

const COMMON_TOKENS = [
  {
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    symbol: 'USDC',
    decimals: 6,
    type: 'erc20'
  },
  {
    address: '0x4200000000000000000000000000000000000006',
    symbol: 'WETH',
    decimals: 18,
    type: 'erc20'
  },
  {
    address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',
    symbol: 'USDbC',
    decimals: 6,
    type: 'erc20'
  }
];

export interface TokenBalance {
  symbol: string;
  balance: string;
  usdValue: string;
  tokenAddress?: string;
  type: 'native' | 'erc20' | 'erc721';
  decimals?: number;
  tokenId?: string;
  tokenURI?: string;
  metadata?: {
    name?: string;
    description?: string;
    image?: string;
    position?: {
      token0: string;
      token1: string;
      tickLower: number;
      tickUpper: number;
      liquidity: string;
    };
  };
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function retryRpcCall<T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      await delay(RATE_LIMIT_DELAY);
      return retryRpcCall(fn, retries - 1);
    }
    throw error;
  }
}

export async function scanWalletAssets(
  provider: ethers.Provider,
  address: string | undefined | null
): Promise<TokenBalance[]> {
  if (!address || !provider) {
    console.error("Missing provider or address");
    return [];
  }

  let normalizedAddress: string;
  try {
    normalizedAddress = ethers.getAddress(address.toString().trim());
    console.log("Scanning assets for address:", normalizedAddress);
  } catch (error) {
    console.error("Invalid address format in scanWalletAssets:", address, error);
    return [];
  }

  try {
    const ethBalance = await retryRpcCall(() => provider.getBalance(normalizedAddress));
    const assets: TokenBalance[] = [
      {
        symbol: 'ETH',
        balance: ethers.formatEther(ethBalance),
        usdValue: (Number(ethers.formatEther(ethBalance)) * 3000).toString(),
        type: 'native'
      }
    ];

    for (const token of COMMON_TOKENS) {
      try {
        await delay(RATE_LIMIT_DELAY);

        const normalizedTokenAddress = normalizeAddress(token.address);
        if (!normalizedTokenAddress || !isValidAddress(normalizedTokenAddress)) {
          console.warn(`Invalid token address for ${token.symbol}`);
          continue;
        }

        const contract = new ethers.Contract(normalizedTokenAddress, ERC20_ABI, provider);

        try {
          await contract.symbol();
          await contract.decimals();
        } catch (error) {
          console.warn(`Contract at ${normalizedTokenAddress} does not implement ERC20 interface`);
          continue;
        }

        const balance = await retryRpcCall(() => contract.balanceOf(normalizedAddress));

        if (Number(balance) > 0) {
          const formattedBalance = ethers.formatUnits(balance, token.decimals);
          const usdValue = token.symbol === 'USDC' || token.symbol === 'USDbC'
            ? formattedBalance
            : (Number(formattedBalance) * 3000).toString();

          assets.push({
            symbol: token.symbol,
            balance: formattedBalance,
            usdValue,
            tokenAddress: normalizedTokenAddress,
            type: 'erc20',
            decimals: token.decimals
          });
        }
      } catch (error) {
        console.warn(`Error fetching ${token.symbol} balance:`, error);
        continue;
      }
    }

    const knownNFTCollections = [
      { address: '0x03A520B32C04Bf3BE5F46762fce6Cd5031F498c2', name: 'Uniswap V3 Positions' },
      { address: '0x82792F8F57635DC7e4C78FeB5a7a2CFD102A1cC3', name: 'Aerodrome Positions' },
      // Removed: { address: '0x827922686190790b37229fd06084350E74485b72', name: 'Custom NFT Collection' }
      // Handled by use-ethereum.ts as 'Aerodrome Slipstream Positions'
    ];

    for (const nft of knownNFTCollections) {
      try {
        await delay(RATE_LIMIT_DELAY);

        const normalizedNFTAddress = normalizeAddress(nft.address);
        if (!normalizedNFTAddress || !isValidAddress(normalizedNFTAddress)) {
          console.warn(`Invalid NFT contract address: ${nft.address}`);
          continue;
        }

        console.log(`Checking NFT collection: ${nft.name} at ${normalizedNFTAddress}`);

        const balance = await getNftBalance(provider, normalizedNFTAddress, normalizedAddress, nft.name);
        console.log(`NFT balance for ${nft.name}:`, balance);

        if (balance > 0) {
          const tokenCount = Number(balance);
          console.log(`Found ${tokenCount} NFTs in collection ${nft.name}`);

          for (let i = 0; i < tokenCount; i++) {
            try {
              await delay(RATE_LIMIT_DELAY);

              let tokenId;
              try {
                const contract = new ethers.Contract(normalizedNFTAddress, ERC721_ABI, provider);
                tokenId = await retryRpcCall(() =>
                  contract.tokenOfOwnerByIndex(normalizedAddress, i)
                );
                console.log(`Found token ID: ${tokenId.toString()}`);
              } catch (error) {
                console.warn(`Error getting token ID at index ${i}:`, error);
                continue;
              }

              let tokenURI: string | undefined;
              let metadata: any = {};

              try {
                const contract = new ethers.Contract(normalizedNFTAddress, ERC721_ABI, provider);
                tokenURI = await retryRpcCall(() => contract.tokenURI(tokenId));
                console.log(`Token URI for ${tokenId}:`, tokenURI);

                if (tokenURI?.startsWith('ipfs://')) {
                  tokenURI = tokenURI.replace('ipfs://', 'https://ipfs.io/ipfs/');
                }

                if (tokenURI) {
                  const response = await fetch(tokenURI);
                  if (response.ok) {
                    metadata = await response.json();
                    console.log(`Metadata fetched for token ${tokenId}:`, metadata);
                  }
                }
              } catch (error) {
                console.warn(`Error fetching metadata for token ${tokenId}:`, error);
              }

              if (nft.name === 'Uniswap V3 Positions') {
                try {
                  const contract = new ethers.Contract(normalizedNFTAddress, UNISWAP_V3_POSITION_NFT_ABI, provider);
                  const position = await contract.positions(tokenId);
                  metadata.position = {
                    token0: position.token0,
                    token1: position.token1,
                    tickLower: position.tickLower,
                    tickUpper: position.tickUpper,
                    liquidity: position.liquidity.toString()
                  };
                } catch (error) {
                  console.warn(`Error fetching position data for token ${tokenId}:`, error);
                }
              }

              assets.push({
                symbol: 'NFT',
                balance: '1',
                usdValue: '0',
                tokenAddress: normalizedNFTAddress,
                type: 'erc721',
                tokenId: tokenId.toString(),
                tokenURI,
                metadata
              });
            } catch (error) {
              console.warn(`Error processing NFT token ${i}:`, error);
              continue;
            }
          }
        }
      } catch (error) {
        console.warn(`Error scanning NFT collection ${nft.address}:`, error);
        continue;
      }
    }

    return assets;
  } catch (error) {
    console.error('Error scanning wallet assets:', error);
    return [];
  }
}

const tokenMetadataCache = new Map<string, {
  symbol: string;
  decimals: number;
  timestamp: number;
}>();

const CACHE_TTL = 5 * 60 * 1000;

export async function getTokenMetadata(
  tokenAddress: string,
  provider: ethers.Provider
) {
  const cached = tokenMetadataCache.get(tokenAddress);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached;
  }

  try {
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const [symbol, decimals] = await Promise.all([
      retryRpcCall(() => contract.symbol()),
      retryRpcCall(() => contract.decimals())
    ]);

    const metadata = { symbol, decimals, timestamp: Date.now() };
    tokenMetadataCache.set(tokenAddress, metadata);
    return metadata;
  } catch (error) {
    console.error(`Error fetching token metadata for ${tokenAddress}:`, error);
    throw error;
  }
}

export async function getNftBalance(
  provider: ethers.Provider,
  contractAddress: string,
  ownerAddress: string,
  collectionName: string
): Promise<number> {
  try {
    console.log(`Checking NFT collection: ${collectionName} at ${contractAddress}`);

    const normalizedContract = ethers.getAddress(contractAddress);
    const normalizedOwner = ethers.getAddress(ownerAddress);

    const nftContract = new ethers.Contract(
      normalizedContract,
      ['function balanceOf(address) view returns (uint256)'],
      provider
    );

    try {
      const balance = await nftContract.balanceOf(normalizedOwner);
      return Number(balance);
    } catch (innerError: any) {
      if (innerError.code === 'BAD_DATA') {
        console.warn(`Could not decode result data for ${collectionName} balance. Using alternate method.`);

        const iface = new ethers.Interface([
          'function balanceOf(address) view returns (uint256)'
        ]);

        const data = iface.encodeFunctionData('balanceOf', [normalizedOwner]);

        try {
          const result = await provider.call({
            to: normalizedContract,
            data: data
          });

          if (result && result !== '0x') {
            const decodedResult = iface.decodeFunctionResult('balanceOf', result);
            const balance = Number(decodedResult[0]);
            console.log(`Successfully got balance using low-level call: ${balance}`);
            return balance;
          }
        } catch (lowLevelError) {
          console.error('Low-level call failed:', lowLevelError);
        }

        console.warn(`Falling back to 0 balance for ${collectionName}`);
        return 0;
      }
      throw innerError;
    }
  } catch (error) {
    console.error(`Error getting NFT balance for ${collectionName}:`, error);
    return 0;
  }
}