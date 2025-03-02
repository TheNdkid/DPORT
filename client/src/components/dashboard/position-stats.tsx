import { useQuery } from "@tanstack/react-query";
import { useEthereum } from "@/hooks/use-ethereum";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, AlertCircle, WifiOff, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Position } from "@/shared/types";
import { RiskMeter } from "./risk-meter";
import React, { useState, useCallback } from "react";
import { AerodromePositions } from "./aerodrome-positions";
import { Button } from "@/components/ui/button"; // Added import for Button
import { formatTokenAmount, formatUSD } from "@/lib/formatting";

const formatPercentage = (amount: number | undefined): string => {
  if (amount === undefined) return 'N/A';
  return `${amount.toFixed(2)}%`;
};


export function PositionStats() {
  const { address, provider } = useEthereum();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    data: positions,
    error,
    isLoading,
    refetch
  } = useQuery({
    queryKey: ["positions", address],
    queryFn: async () => {
      if (!address) return [];

      const response = await fetch(`/api/wallet/${address}/positions`);
      if (!response.ok) {
        throw new Error("Failed to fetch positions");
      }

      return await response.json();
    },
    enabled: !!address,
    refetchInterval: 30000, // Auto refresh every 30 seconds
  });

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Fetching your positions...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Failed to load positions: {error.message}</AlertDescription>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          className="mt-2"
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Retrying...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </>
          )}
        </Button>
      </Alert>
    );
  }

  if (!positions || positions.length === 0) {
    return (
      <Alert>
        <WifiOff className="h-4 w-4" />
        <AlertTitle>No Positions Found</AlertTitle>
        <AlertDescription>
          You don't have any active positions in your wallet. Add liquidity to a pool to get started.
        </AlertDescription>
      </Alert>
    );
  }

  // Transform positions data into the format expected by LiquidityPositionCard
  const formattedPositions = positions.map((position: Position) => {
    return {
      id: position.id.toString(),
      protocol: position.protocol,
      poolName: position.type || `${position.token0Symbol || 'Token0'}/${position.token1Symbol || 'Token1'}`,
      poolAddress: position.poolAddress || '',
      token0: {
        symbol: position.token0Symbol || 'Token0',
        address: position.token0 || '',
        amount: position.token0Amount || '0',
        decimals: position.token0Decimals || 18
      },
      token1: {
        symbol: position.token1Symbol || 'Token1',
        address: position.token1 || '',
        amount: position.token1Amount || '0',
        decimals: position.token1Decimals || 18
      },
      feeTier: position.feeTier ? `${parseFloat(position.feeTier) / 10000}%` : undefined,
      apr: parseFloat(position.apy) || 0,
      tvl: parseFloat(position.tvl) || 0,
      fees24h: position.fees24h || 0,
      priceRange: position.priceLower && position.priceUpper ? {
        lower: position.priceLower,
        upper: position.priceUpper,
        current: position.currentPrice || 'Unknown'
      } : undefined,
      rewards: position.rewards ? position.rewards.map(reward => ({
        symbol: reward.symbol,
        amount: reward.amount,
        decimals: reward.decimals || 18,
        usdValue: reward.usdValue || 0
      })) : []
    };
  });

  // Dummy LiquidityPositionCard component (replace with your actual component)
  const LiquidityPositionCard = ({ position, refreshCallback }: { position: any; refreshCallback: () => void }) => (
    <Card>
      <CardHeader>
        <CardTitle>{position.poolName}</CardTitle>
      </CardHeader>
      <CardContent>
        <div>
          <p>Protocol: {position.protocol}</p>
          <p>Token0: {position.token0.symbol} - {formatTokenAmount(position.token0.amount, position.token0.decimals)}</p>
          <p>Token1: {position.token1.symbol} - {formatTokenAmount(position.token1.amount, position.token1.decimals)}</p>
          <p>APR: {formatPercentage(position.apr)}</p>
          <p>24h Fees: {formatUSD(position.fees24h)}</p>
          {position.rewards.length > 0 && (
            <p>Rewards: {position.rewards.map(r => `${formatTokenAmount(r.amount, r.decimals)} ${r.symbol}`).join(', ')}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );


  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>Liquidity Positions</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </>
              )}
            </Button>
          </CardHeader>
          <CardContent>
            <AerodromePositions onRefresh={handleRefresh} />

            {/* Grid of position cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 mt-4">
              {formattedPositions.map(position => (
                <LiquidityPositionCard
                  key={position.id}
                  position={position}
                  refreshCallback={handleRefresh}
                />
              ))}
            </div>

            {/* Detailed table view */}
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-4">Detailed Position Table</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pool</TableHead>
                    <TableHead>Protocol</TableHead>
                    <TableHead>TVL</TableHead>
                    <TableHead>APR</TableHead>
                    <TableHead>24h Fees</TableHead>
                    <TableHead>Risk</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.map((position: Position) => (
                    <TableRow key={position.id}>
                      <TableCell>
                        {position.token0Symbol && position.token1Symbol
                          ? `${position.token0Symbol}/${position.token1Symbol}`
                          : position.type || 'Unknown Pool'
                        }
                      </TableCell>
                      <TableCell>{position.protocol}</TableCell>
                      <TableCell>{formatUSD(position.tvl)}</TableCell>
                      <TableCell>{formatPercentage(position.apy)}</TableCell>
                      <TableCell>{formatUSD(position.fees24h || 0)}</TableCell>
                      <TableCell>
                        <RiskMeter score={position.riskScore || Math.random() * 100} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </ErrorBoundary>
  );
}