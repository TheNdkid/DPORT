import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpDown, BarChart, CreditCard, DollarSign, Percent } from "lucide-react";
import { formatTokenAmount, formatUSD, formatPercentage } from "@/lib/formatting";
import { useEthereum } from "@/hooks/use-ethereum";

interface TokenInfo {
  symbol: string;
  address: string;
  amount?: string;
  decimals: number;
}

interface Position {
  id: string;
  protocol: string;
  poolName: string;
  poolAddress: string;
  token0: TokenInfo;
  token1: TokenInfo;
  feeTier?: string;
  apr?: number;
  tvl?: number;
  fees24h?: number;
  rewards?: {
    symbol: string;
    amount: string;
    decimals: number;
    usdValue: number;
  }[];
  priceRange?: {
    lower: string;
    upper: string;
    current: string;
  };
  type?: 'vamm' | 'slipstream'; // Added to distinguish position types
  tokenId?: string; // Added for Slipstream NFT token ID
}

interface Props {
  position: Position;
  refreshCallback?: () => void;
}

export function LiquidityPositionCard({ position, refreshCallback }: Props) {
  const { provider } = useEthereum();
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    if (!provider || !position.poolAddress) return;

    // Set up event listeners for real-time updates
    const setupEventListeners = async () => {
      try {
        const poolContract = new ethers.Contract(
          position.poolAddress,
          [
            "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)",
            "event Collect(address indexed owner, address recipient, int24 tickLower, int24 tickUpper, uint128 amount0, uint128 amount1)"
          ],
          provider
        );

        // Listen for swap events which might affect the position's value
        poolContract.on("Swap", (sender, recipient, amount0, amount1, sqrtPrice, liquidity, tick) => {
          console.log("Swap event detected in pool:", position.poolName);
          if (refreshCallback) refreshCallback();
          setLastUpdated(new Date());
        });

        // Listen for collect events which might affect the position
        poolContract.on("Collect", (owner, recipient, tickLower, tickUpper, amount0, amount1) => {
          console.log("Collect event detected for position:", position.id);
          if (refreshCallback) refreshCallback();
          setLastUpdated(new Date());
        });

        return () => {
          poolContract.removeAllListeners();
        };
      } catch (error) {
        console.error("Error setting up event listeners:", error);
      }
    };

    setupEventListeners();
  }, [provider, position.poolAddress, position.id, refreshCallback]);

  // Placeholder for formatCurrency -  replace with your actual implementation
  const formatCurrency = (value: string, decimals: number): string => {
    return parseFloat(value).toFixed(decimals);
  }

  // Format values for display
  const formattedValues = {
    token0Amount: formatCurrency(position.token0.amount || '0', position.token0.decimals),
    token1Amount: formatCurrency(position.token1.amount || '0', position.token1.decimals),
    stakedAmount: position.token0.amount ? formatCurrency(position.token0.amount, position.token0.decimals) : undefined,
    unstakedAmount: position.token1.amount ? formatCurrency(position.token1.amount, position.token1.decimals) : undefined,
    earnedRewards: undefined, // Placeholder - needs implementation based on your data structure
    lowerPrice: position.priceRange?.lower ? formatCurrency(position.priceRange.lower, 6) : undefined,
    upperPrice: position.priceRange?.upper ? formatCurrency(position.priceRange.upper, 6) : undefined
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-900">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2">
              {position.poolName}
              <Badge variant="outline" className="ml-2">
                {position.protocol}
              </Badge>
            </CardTitle>
            <CardDescription>
              Position #{position.id.substring(0, 8)}
              {position.feeTier && <span className="ml-2">Fee: {position.feeTier}</span>}
            </CardDescription>
          </div>
          {position.apr !== undefined && (
            <Badge variant="secondary" className="text-lg">
              {formatPercentage(position.apr)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">Tokens</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span>{position.token0.symbol}</span>
                <span className="font-mono">
                  {isLoading ? (
                    <Skeleton className="h-4 w-20" />
                  ) : (
                    formattedValues.token0Amount
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>{position.token1.symbol}</span>
                <span className="font-mono">
                  {isLoading ? (
                    <Skeleton className="h-4 w-20" />
                  ) : (
                    formattedValues.token1Amount
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">Value</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span>TVL</span>
                <span className="font-mono">
                  {isLoading ? (
                    <Skeleton className="h-4 w-20" />
                  ) : (
                    formatUSD(position.tvl || 0)
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Daily Fees</span>
                <span className="font-mono">
                  {isLoading ? (
                    <Skeleton className="h-4 w-20" />
                  ) : (
                    formatUSD(position.fees24h || 0)
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-2 text-sm text-gray-600 space-y-1">
          <p><span className="font-semibold">{position.token0.symbol}:</span> {formattedValues.token0Amount}</p>
          <p><span className="font-semibold">{position.token1.symbol}:</span> {formattedValues.token1Amount}</p>

          {position.type === 'slipstream' && position.priceRange && (
            <p>
              <span className="font-semibold">Price Range:</span> 
              {formattedValues.lowerPrice} - {formattedValues.upperPrice}
            </p>
          )}

          {position.tokenId && (
            <p><span className="font-semibold">Token ID:</span> {position.tokenId}</p>
          )}

          {formattedValues.stakedAmount && (
            <p><span className="font-semibold">Staked:</span> {formattedValues.stakedAmount}</p>
          )}
          {formattedValues.unstakedAmount && (
            <p><span className="font-semibold">Unstaked:</span> {formattedValues.unstakedAmount}</p>
          )}
          {formattedValues.earnedRewards && (
            <p><span className="font-semibold">Rewards:</span> {formattedValues.earnedRewards}</p>
          )}
        </div>


        {position.priceRange && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">Price Range</span>
              </div>
              <span className="text-xs text-gray-500">
                Current: {position.priceRange.current}
              </span>
            </div>
            <div className="relative h-8 bg-gray-100 dark:bg-gray-800 rounded-md overflow-hidden">
              <div 
                className="absolute h-full bg-green-200 dark:bg-green-900 z-10 flex items-center justify-center text-xs"
                style={{
                  left: '10%',
                  right: '10%'
                }}
              >
                <span className="mx-1 whitespace-nowrap overflow-hidden text-ellipsis">
                  {position.priceRange.lower} - {position.priceRange.upper}
                </span>
              </div>
              <div 
                className="absolute h-full w-1 bg-blue-500 z-20"
                style={{
                  left: '50%',
                  transform: 'translateX(-50%)'
                }}
              />
            </div>
          </div>
        )}

        {position.rewards && position.rewards.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-2">
              <BarChart className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium">Rewards</span>
            </div>
            <div className="space-y-2">
              {position.rewards.map((reward, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span>{reward.symbol}</span>
                  <div className="text-right">
                    <div className="font-mono">
                      {formatTokenAmount(reward.amount, reward.decimals)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatUSD(reward.usdValue)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 text-xs text-gray-500 text-right">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  );
}