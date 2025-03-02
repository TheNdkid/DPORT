import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEthereum } from "@/hooks/use-ethereum";
import { getUniswapV4Positions, UniswapV4Position } from "@/services/uniswap-v4";
import { Loader2, Ticket } from "lucide-react";
import { formatTokenAmount } from "@/services/nft-position-scanner";

// Common pools to check for positions
const COMMON_POOLS = [
  "0x4C36d2919e407f0Cc2Ee3c993ccF8ac26d9CE64e", // Example USDC/ETH pool
  "0x6ce6D6D5b41624159165936924B880EeF608bCa2"  // Example USDC/USDT pool
];

export const UniswapV4Positions: React.FC = () => {
  const { baseProvider } = useEthereum();
  const [positions, setPositions] = useState<UniswapV4Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!baseProvider) return;

    const fetchPositions = async () => {
      try {
        console.log('Starting to fetch Uniswap V4 positions...');
        setLoading(true);
        setError(null);

        const signer = await baseProvider.getSigner();
        const walletAddress = await signer.getAddress();
        console.log('Fetching V4 positions for wallet:', walletAddress);

        // Check positions in common pools
        console.log('Checking common pools:', COMMON_POOLS);
        const positionPromises = COMMON_POOLS.map(async poolAddress => {
          console.log(`Checking pool ${poolAddress}...`);
          try {
            const position = await getUniswapV4Positions(baseProvider, walletAddress, poolAddress);
            console.log(`Pool ${poolAddress} result:`, position);
            return position;
          } catch (error) {
            // Handle specific ethers.js errors
            if (error instanceof Error && error.message.includes('bad address checksum')) {
              console.error(`Address checksum error for pool ${poolAddress}:`, error);
              // Try again with normalized address
              try {
                const position = await getUniswapV4Positions(baseProvider, walletAddress.toLowerCase(), poolAddress.toLowerCase());
                console.log(`Retry with normalized addresses for pool ${poolAddress} result:`, position);
                return position;
              } catch (retryError) {
                console.error(`Retry failed for pool ${poolAddress}:`, retryError);
                return null;
              }
            }
            console.error(`Error checking pool ${poolAddress}:`, error);
            return null;
          }
        });

        const results = await Promise.all(positionPromises);
        const validPositions = results.filter((pos): pos is UniswapV4Position => pos !== null);

        console.log('Found valid V4 positions:', validPositions);
        setPositions(validPositions);

        if (validPositions.length === 0) {
          console.log('No Uniswap V4 positions found in common pools');
        } else {
          console.log(`Found ${validPositions.length} V4 positions`);
        }
      } catch (error) {
        console.error("Error fetching Uniswap V4 positions:", error);
        setError(error instanceof Error ? error.message : "Failed to fetch Uniswap V4 positions");
      } finally {
        setLoading(false);
      }
    };

    fetchPositions();
  }, [baseProvider]);

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

  if (positions.length === 0) {
    return null;
  }

  return (
    <>
      {positions.map((position, index) => (
        <Card key={`${position.poolAddress}-${index}`} className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5 text-purple-500" />
              Uniswap V4 Position
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p>
                <strong>Liquidity:</strong> {formatTokenAmount(position.liquidity)}
              </p>
              <p>
                <strong>Price Range:</strong> ${position.minPrice} - ${position.maxPrice}
              </p>
              <div>
                <strong>Unclaimed Fees:</strong>
                <ul className="list-disc list-inside pl-4">
                  <li>{formatTokenAmount(position.tokensOwed0)} Token0</li>
                  <li>{formatTokenAmount(position.tokensOwed1)} Token1</li>
                </ul>
              </div>
              <p className="text-sm text-muted-foreground">
                <strong>Pool:</strong> {position.poolAddress}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
};