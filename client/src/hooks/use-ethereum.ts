import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useQuery } from '@tanstack/react-query';
import { fetchAllPositions } from '../services/dex';
import { scanWalletAssets } from '../services/wallet-scanner';
import { isValidAddress, normalizeAddress } from '@shared/utils/address';

const STORAGE_KEY = 'connected_address';
const BASE_CHAIN_ID = 8453;

const BASE_RPC_URLS = [
  "https://mainnet.base.org",
  "https://base-mainnet.g.alchemy.com/v2/demo",
  "https://base.llamarpc.com",
  "https://1rpc.io/base",
  "https://base.meowrpc.com"
];

const MAX_RPC_RETRIES = 3;
const RPC_RETRY_DELAY = 2000;

const POSITION_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
];

export function useEthereum() {
  const [address, setAddress] = useState<string | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return validateAndNormalizeAddress(stored);
    } catch (error) {
      console.error('Error reading stored address:', error);
      return null;
    }
  });

  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [baseProvider, setBaseProvider] = useState<ethers.JsonRpcProvider | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [rpcError, setRpcError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  const handleAccountsChanged = useCallback(async (accounts: string[]) => {
    try {
      if (!accounts || accounts.length === 0) {
        console.log('No accounts available, disconnecting');
        setAddress(null);
        localStorage.removeItem(STORAGE_KEY);
        return;
      }

      const newAddress = accounts[0];
      console.log('Processing new address:', newAddress);

      const normalized = validateAndNormalizeAddress(newAddress);
      if (normalized) {
        console.log('Setting normalized address:', normalized);
        setAddress(normalized);
        localStorage.setItem(STORAGE_KEY, normalized);
      } else {
        console.error('Failed to normalize address:', newAddress);
        setAddress(null);
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      console.error('Error handling account change:', error);
      setAddress(null);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const initializeProviders = useCallback(async () => {
    try {
      if (!window.ethereum) {
        console.log('MetaMask not installed');
        setInitializing(false);
        return;
      }

      const baseProvider = await createBaseProvider();
      if (baseProvider) {
        setBaseProvider(baseProvider);
        setRpcError(null);
      } else {
        setRpcError('Failed to connect to Base network');
      }

      try {
        const browserProvider = new ethers.BrowserProvider(window.ethereum);
        setProvider(browserProvider);

        try {
          const network = await browserProvider.getNetwork();
          setChainId(Number(network.chainId));
        } catch (chainIdError) {
          console.warn('Could not fetch chain ID from browser provider, using default:', chainIdError);
          setChainId(BASE_CHAIN_ID);
        }
      } catch (providerError) {
        console.warn('Browser provider initialization failed, using Base provider only:', providerError);
      }
    } catch (error) {
      console.error('Error initializing providers:', error);
      setRpcError('Failed to initialize wallet connection');
    } finally {
      setInitializing(false);
    }
  }, []);

  useEffect(() => {
    initializeProviders();

    const handleChainChanged = (chainId: string) => {
      try {
        const parsedChainId = chainId.startsWith('0x') ? parseInt(chainId, 16) : Number(chainId);
        if (!isNaN(parsedChainId)) {
          setChainId(parsedChainId);
        } else {
          console.warn('Invalid chainId received:', chainId);
        }
      } catch (error) {
        console.error('Error handling chain change:', error);
      }
    };

    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        if (window.ethereum) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
          window.ethereum.removeListener('chainChanged', handleChainChanged);
        }
      };
    }
  }, [initializeProviders, handleAccountsChanged]);

  const { data: assets, isLoading: assetsLoading } = useQuery({
    queryKey: ['wallet-assets', address, chainId],
    queryFn: async () => {
      if (!provider || !address || chainId !== BASE_CHAIN_ID) {
        return [];
      }
      try {
        return await scanWalletAssets(provider, address);
      } catch (error) {
        console.error('Error fetching wallet assets:', error);
        return [];
      }
    },
    enabled: !!provider && !!address && chainId === BASE_CHAIN_ID,
    refetchInterval: 30000,
    select: (data) => ({
      tokens: data.filter(asset => asset.type === 'native' || asset.type === 'erc20'),
      nfts: data.filter(asset => asset.type === 'erc721')
    })
  });

  const { data: positions, isLoading: positionsLoading, error: positionsError } = useQuery({
    queryKey: ['positions', address, chainId],
    queryFn: async () => {
      if (!address || typeof address !== 'string') {
        console.error('No valid address provided for fetching positions');
        return [];
      }
      try {
        console.log('Fetching positions for normalized address:', address);
        return await fetchAllPositions(address);
      } catch (error) {
        console.error('Error fetching positions:', error);
        return [];
      }
    },
    enabled: !!address && typeof address === 'string' && chainId === BASE_CHAIN_ID,
  });

  const { data: nftBalances, isLoading: nftLoading } = useQuery({
    queryKey: ['nft-balances', address, chainId],
    queryFn: async () => {
      if (!baseProvider || !address || typeof address !== 'string') return [];
      const collections = [
        { name: 'Uniswap V3 Positions', address: '0x03A520B32C04Bf3BE5F46762fce6Cd5031F498c2' },
        { name: 'Aerodrome Positions', address: '0x82792F8F57635DC7e4C78FeB5a7a2CFD102A1cC3' },
        { name: 'Aerodrome Slipstream Positions', address: '0x827922686190790b37229fd06084350E74485b72' },
      ];

      const results = await Promise.all(collections.map(async (collection) => {
        console.log(`Checking NFT collection: ${collection.name} at ${collection.address}`);
        try {
          const contract = new ethers.Contract(collection.address, POSITION_ABI, baseProvider);
          const balance = await contract.balanceOf(address);
          console.log(`NFT balance for ${collection.name}: ${balance.toString()}`);
          const tokenIds = [];
          const metadata = [];
          if (Number(balance) > 0) {
            for (let i = 0; i < Number(balance); i++) {
              const tokenId = await contract.tokenOfOwnerByIndex(address, i);
              tokenIds.push(tokenId.toString());
              console.log(`Found token ID: ${tokenId.toString()}`);
              try {
                const tokenURI = await contract.tokenURI(tokenId);
                console.log(`Token URI for ${tokenId.toString()}: ${tokenURI}`);
                const metadataJson = atob(tokenURI.split(',')[1]);
                metadata.push(JSON.parse(metadataJson));
                console.log(`Metadata fetched for token ${tokenId.toString()}:`, metadata[metadata.length - 1]);
              } catch (metadataError) {
                console.error(`Error fetching metadata for token ${tokenId}:`, metadataError);
              }
            }
          }
          return { ...collection, balance: Number(balance), tokenIds, metadata };
        } catch (error) {
          console.error(`Error fetching balance for ${collection.name}:`, error.message);
          console.log(`Falling back to 0 balance for ${collection.name}`);
          return { ...collection, balance: 0, tokenIds: [], metadata: [] };
        }
      }));
      return results;
    },
    enabled: !!baseProvider && !!address && typeof address === 'string' && chainId === BASE_CHAIN_ID,
  });

  function validateAndNormalizeAddress(address: string | null): string | null {
    try {
      if (!address) {
        console.debug('No address provided');
        return null;
      }
      if (typeof address !== 'string') {
        console.warn('Invalid address type:', typeof address);
        return null;
      }
      const cleaned = address.toLowerCase().trim();
      if (!cleaned) {
        console.warn('Address is empty after cleaning');
        return null;
      }
      try {
        if (cleaned.startsWith('xE')) {
          return ethers.getIcapAddress(cleaned);
        }
      } catch (icapError) {
        console.debug('Not an ICAP address, trying standard format');
      }
      const checksummed = ethers.getAddress(cleaned);
      if (!ethers.isAddress(checksummed)) {
        console.warn('Invalid Ethereum address:', address);
        return null;
      }
      return checksummed;
    } catch (error) {
      console.error('Address validation failed:', error);
      return null;
    }
  }

  return {
    address,
    provider,
    baseProvider,
    chainId,
    positions,
    positionsLoading,
    assets: assets?.tokens || [],
    nfts: assets?.nfts || [],
    nftBalances: nftBalances || [],
    assetsLoading,
    nftLoading,
    rpcError,
    initializing,
    connect: async () => {
      if (!window.ethereum) throw new Error('MetaMask not installed');
      if (!provider) throw new Error('Provider not initialized');

      try {
        console.log('Requesting account access...');
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts'
        });

        if (!accounts?.length) {
          console.warn('No accounts returned from wallet');
          throw new Error('No accounts available');
        }

        console.log('Got account:', accounts[0]);
        return handleAccountsChanged(accounts);
      } catch (error) {
        console.error('Connection error:', error);
        throw error;
      }
    },
    disconnect: () => {
      setAddress(null);
      localStorage.removeItem(STORAGE_KEY);
    },
    switchToBase: async () => {
      if (!window.ethereum) throw new Error('MetaMask not installed');

      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${BASE_CHAIN_ID.toString(16)}` }]
        });
      } catch (error: any) {
        if (error.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${BASE_CHAIN_ID.toString(16)}`,
              chainName: 'Base',
              nativeCurrency: {
                name: 'ETH',
                symbol: 'ETH',
                decimals: 18
              },
              rpcUrls: BASE_RPC_URLS,
              blockExplorerUrls: ['https://basescan.org/']
            }]
          });
        } else {
          throw error;
        }
      }
    },
    isConnected: !!address,
    isBaseNetwork: chainId === BASE_CHAIN_ID
  };
}

declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, handler: (...args: any[]) => void) => void;
      removeListener: (event: string, handler: (...args: any[]) => void) => void;
    };
  }
}

async function createBaseProvider(): Promise<ethers.JsonRpcProvider | null> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RPC_RETRIES; attempt++) {
    for (const rpcUrl of BASE_RPC_URLS) {
      try {
        console.log(`Attempting to connect to Base RPC (attempt ${attempt + 1}/${MAX_RPC_RETRIES}):`, rpcUrl);

        const provider = new ethers.JsonRpcProvider(rpcUrl, {
          chainId: BASE_CHAIN_ID,
          name: 'base',
          ensAddress: null
        });

        const blockNumber = await provider.getBlockNumber();
        console.log('Successfully connected to Base network, current block:', blockNumber);

        try {
          const network = await provider.getNetwork();
          const chainId = Number(network.chainId);

          if (chainId !== BASE_CHAIN_ID) {
            throw new Error(`Wrong network: expected ${BASE_CHAIN_ID}, got ${chainId}`);
          }

          return provider;
        } catch (networkError) {
          console.warn('Network details unavailable, but connection works:', networkError);
          return provider;
        }
      } catch (error) {
        console.warn(`Failed to connect to RPC ${rpcUrl}:`, error);
        lastError = error as Error;

        await new Promise(resolve => setTimeout(resolve, RPC_RETRY_DELAY));
        continue;
      }
    }
  }

  console.error('Failed to connect to any Base RPC:', lastError);
  return null;
}