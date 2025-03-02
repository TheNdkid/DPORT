import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEthereum } from "@/hooks/use-ethereum";
import { checkLPNFTPosition, formatTokenAmount, getPositionPriceRange } from "@/services/nft-position-scanner";
import { Loader2, Ticket } from "lucide-react";
import { ethers } from 'ethers';
import { normalizeAddress } from "@/lib/address";

interface NFTPosition {
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

interface Props {
  poolAddress: string;
  protocol: string;
  positionManagerAddress: string;
}

export const NFTLPPositions: React.FC<Props> = ({ 
  poolAddress, 
  protocol, 
  positionManagerAddress 
}) => {
  const { baseProvider } = useEthereum();
  const [lpPosition, setLpPosition] = useState<NFTPosition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenSymbols, setTokenSymbols] = useState<{token0: string; token1: string}>({ token0: '', token1: '' });

  useEffect(() => {
    if (!baseProvider || !poolAddress) return;

    const fetchPosition = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get signer and wallet address first
        const signer = await baseProvider.getSigner();
        const walletAddress = await signer.getAddress();

        // Normalize addresses before use
        const normalizedPool = normalizeAddress(poolAddress);
        const normalizedPositionManager = normalizeAddress(positionManagerAddress);
        const normalizedWallet = normalizeAddress(walletAddress);

        if (!normalizedPool || !normalizedPositionManager || !normalizedWallet) {
          throw new Error('Invalid address format detected');
        }

        // Use normalized addresses for contract interactions
        const data = await checkLPNFTPosition(
          baseProvider,
          normalizedPositionManager,
          normalizedPool,
          normalizedWallet
        );

        if (data) {
          // Normalize token addresses before creating contracts
          const normalizedToken0 = normalizeAddress(data.token0);
          const normalizedToken1 = normalizeAddress(data.token1);

          if (!normalizedToken0 || !normalizedToken1) {
            throw new Error('Invalid token addresses in position data');
          }

          // Create contracts with normalized addresses
          const token0Contract = new ethers.Contract(
            normalizedToken0,
            ['function symbol() view returns (string)'],
            baseProvider
          );
          const token1Contract = new ethers.Contract(
            normalizedToken1,
            ['function symbol() view returns (string)'],
            baseProvider
          );

          const [symbol0, symbol1] = await Promise.all([
            token0Contract.symbol(),
            token1Contract.symbol()
          ]);

          setTokenSymbols({ token0: symbol0, token1: symbol1 });
        }

        setLpPosition(data);
      } catch (error) {
        console.error("Error fetching NFT position:", error);
        setError(error instanceof Error ? error.message : "Failed to fetch NFT position");
      } finally {
        setLoading(false);
      }
    };

    fetchPosition();
  }, [baseProvider, poolAddress, positionManagerAddress]);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-4">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return <p className="text-red-500 p-4">{error}</p>;
  }

  if (!lpPosition) {
    return null;
  }

  const priceRange = getPositionPriceRange(lpPosition);

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ticket className="h-5 w-5 text-purple-500" />
          {protocol} NFT LP Position
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p>
            <strong>Pool:</strong> {tokenSymbols.token0} / {tokenSymbols.token1}
          </p>
          <p>
            <strong>Position ID:</strong> {lpPosition.tokenId}
          </p>
          <p>
            <strong>Price Range:</strong> {priceRange.lower} - {priceRange.upper}
          </p>
          <p>
            <strong>Liquidity:</strong> {formatTokenAmount(lpPosition.liquidity)}
          </p>
          <div>
            <strong>Unclaimed Fees:</strong>
            <ul className="list-disc list-inside pl-4">
              <li>{formatTokenAmount(lpPosition.tokensOwed0, lpPosition.token0Decimals)} {tokenSymbols.token0}</li>
              <li>{formatTokenAmount(lpPosition.tokensOwed1, lpPosition.token1Decimals)} {tokenSymbols.token1}</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};