import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useEthereum } from '@/hooks/use-ethereum';
import { fetchAllAerodromePositions } from '@/services/aerodrome';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatTokenAmount, formatUSD } from '@/lib/formatting';

interface Props {
  onRefresh?: () => void;
}

export function AerodromePositions({ onRefresh }: Props) {
  const { provider, address } = useEthereum();
  const { data: positions, isLoading, error, refetch } = useQuery({
    queryKey: ['aerodromePositions', address],
    queryFn: async () => {
      if (!provider || !address) return [];
      return fetchAllAerodromePositions(address);
    },
    enabled: !!provider && !!address,
    staleTime: 60 * 1000, // 1 minute
  });

  const handleRefresh = async () => {
    if (onRefresh) {
      onRefresh();
    }
    refetch();
  };

  if (!address) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Aerodrome Liquidity Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Connect your wallet to view positions</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Aerodrome Liquidity Positions</CardTitle>
          <Button variant="outline" size="icon" disabled>
            <Loader2 className="h-4 w-4 animate-spin" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex flex-col space-y-2">
                <Skeleton className="h-10 w-full" />
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error instanceof Error ? error.message : 'Failed to load positions'}</AlertDescription>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh} 
          className="mt-2"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Aerodrome Liquidity Positions</CardTitle>
        <Button variant="outline" size="icon" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {positions && positions.length > 0 ? (
          <div className="space-y-4">
            {positions.map((position, index) => (
              <div key={index} className="rounded-md border p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold">
                    {position.token0.symbol}/{position.token1.symbol}
                  </h3>
                  <a
                    href={`https://basescan.org/address/${position.poolAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground flex items-center"
                  >
                    View Pool <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Token 0</p>
                    <p className="font-mono">
                      {position.token0.amount} {position.token0.symbol}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Token 1</p>
                    <p className="font-mono">
                      {position.token1.amount} {position.token1.symbol}
                    </p>
                  </div>
                </div>
                {position.earnedRewards && (
                  <div className="mt-2 pt-2 border-t">
                    <p className="text-xs text-muted-foreground">Earned Rewards</p>
                    <p className="font-mono">{formatTokenAmount(position.earnedRewards, 18)} AERO</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground">No Aerodrome positions found</p>
        )}
      </CardContent>
    </Card>
  );
}