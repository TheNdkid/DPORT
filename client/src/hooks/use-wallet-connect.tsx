
import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { configureChains, createConfig, WagmiConfig, useAccount, useConnect, useDisconnect } from 'wagmi';
import { base } from 'wagmi/chains';
import { EthereumClient, w3mConnectors, w3mProvider } from '@web3modal/ethereum';
import { Web3Modal } from '@web3modal/react';

// Define the wallet context
interface WalletContextType {
  address: string | undefined;
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => void;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType>({
  address: undefined,
  isConnected: false,
  isConnecting: false,
  connect: () => {},
  disconnect: () => {}
});

// You should replace this with your actual project ID from WalletConnect Cloud
const projectId = 'YOUR_PROJECT_ID';

// Configure chains & providers with the public provider (mainnet & Base)
const { chains, publicClient } = configureChains(
  [base],
  [w3mProvider({ projectId })]
);

// Set up wagmi config
const wagmiConfig = createConfig({
  autoConnect: true,
  connectors: w3mConnectors({ projectId, chains }),
  publicClient
});

// Create ethereum client
const ethereumClient = new EthereumClient(wagmiConfig, chains);

// Wallet provider component
export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <>
      <WagmiConfig config={wagmiConfig}>
        <WalletConnectionProvider>
          {children}
        </WalletConnectionProvider>
      </WagmiConfig>
      <Web3Modal projectId={projectId} ethereumClient={ethereumClient} />
    </>
  );
}

// Internal wallet connection provider
function WalletConnectionProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const { connect, isLoading: isConnecting, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  
  const handleConnect = () => {
    // Connect using the first available connector (usually MetaMask)
    connect({ connector: connectors[0] });
  };

  const value = {
    address,
    isConnected,
    isConnecting,
    connect: handleConnect,
    disconnect
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

// Hook to use wallet connection
export function useWalletConnect() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWalletConnect must be used within a WalletProvider');
  }
  return context;
}
