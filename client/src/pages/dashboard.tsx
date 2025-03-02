import { useEffect } from "react";
import { useLocation } from "wouter";
import { useEthereum } from "@/hooks/use-ethereum";
import { PortfolioOverview } from "@/components/dashboard/portfolio-overview";
import { AssetList } from "@/components/dashboard/asset-list";
import { PositionStats } from "@/components/dashboard/position-stats";
import { RiskMetrics } from "@/components/dashboard/risk-metrics";
import { StrategySuggestions } from "@/components/dashboard/strategy-suggestions";
import { WalletAssets } from "@/components/dashboard/wallet-assets";
import { apiRequest } from "@/lib/queryClient";

// Placeholder NFTGrid component
const NFTGrid = () => {
  return (
    <div>
      <h2>NFT Grid (Placeholder)</h2>
      <p>This section will display NFTs from your wallet once implemented.</p>
    </div>
  );
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { address, isConnected, chainId } = useEthereum();
  const BASE_CHAIN_ID = 8453; // Base network chain ID

  // Redirect to home if not connected
  useEffect(() => {
    if (!isConnected) {
      setLocation("/");
    }
  }, [isConnected, setLocation]);

  // Sync wallet data when connected
  useEffect(() => {
    if (address && chainId === BASE_CHAIN_ID) {
      console.log('Syncing wallet data for address:', address);
      apiRequest("POST", `/api/wallet/${address}/sync`)
        .catch(error => {
          console.error('Error syncing wallet data:', error);
        });
    }
  }, [address, chainId]);

  if (!isConnected) return null;

  return (
    <div className="container mx-auto p-6">
      <div className="grid gap-6">
        <PortfolioOverview />
        <WalletAssets />
        <div className="grid gap-6 md:grid-cols-2">
          <AssetList />
          <PositionStats />
        </div>
        <StrategySuggestions />
        <RiskMetrics />
      </div>
      <div className="mt-6">
        <NFTGrid />
      </div>
    </div>
  );
}