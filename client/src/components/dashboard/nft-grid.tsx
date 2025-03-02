import { useQuery } from "@tanstack/react-query";
import { useEthereum } from "@/hooks/use-ethereum";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import React, { useState } from "react";
import { ethers } from "ethers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, ExternalLink } from "lucide-react";


interface NFTDetails {
  token0: string;
  token1: string;
  token0Symbol?: string;
  token1Symbol?: string;
  fee: number;
  liquidity: string;
  poolAddress?: string;
  tokenId?: string;
  contractAddress?: string;
  priceRange?: { lower: string; upper: string };
  lowerPrice?: string;
  upperPrice?: string;
}

interface NFT {
  id: string;
  name: string;
  imageUrl: string;
  collectionName: string;
  details?: NFTDetails;
}

// Placeholder for ethers.utils.formatUnits functionality
const formatTokenAmount = (amount, decimals) => {
  try {
    const formattedAmount = ethers.utils.formatUnits(amount, decimals);
    return parseFloat(formattedAmount).toFixed(2); // Added toFixed for better display
  } catch (error) {
    console.error("Error formatting token amount:", error);
    return amount;
  }
};

export function NFTGrid() {
  console.log("Rendering NFTGrid");
  const { address } = useEthereum();
  const [expandedNft, setExpandedNft] = useState(null);

  const { data: nfts, isLoading } = useQuery({
    queryKey: ["/api/wallet", address, "nfts"],
    enabled: !!address
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>NFT Collection</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!nfts || nfts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>NFT Collection</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center py-4">No NFTs found</p>
        </CardContent>
      </Card>
    );
  }

  // Helper function to determine if this is a liquidity position NFT
  const isLiquidityPosition = (nft) => {
    return nft.details && (nft.details.token0 || nft.details.poolAddress);
  };

  // Normalize token address format for display
  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0,6)}...${address.slice(-4)}`;
  };

  // Format liquidity value (using placeholder formatter)

  // Create external link for block explorer
  const getExplorerLink = (address, chainId = 8453) => {
    // Using basescan for Base network
    return `https://basescan.org/token/${address}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>NFT Collection</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {nfts?.map((nft: NFT) => (
            <Card key={nft.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <div className="aspect-square relative">
                <img
                  src={nft.imageUrl}
                  alt={nft.name}
                  className="object-cover w-full h-full"
                />
                {isLiquidityPosition(nft) && (
                  <Badge className="absolute top-2 right-2 bg-purple-500 text-white">
                    Liquidity Position
                  </Badge>
                )}
              </div>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <h3 className="font-medium truncate">{nft.name}</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setExpandedNft(expandedNft === nft.id ? null : nft.id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-gray-500 mb-2">{nft.collectionName}</p>

                  {expandedNft === nft.id ? (
                    <div className="text-xs space-y-2 text-gray-600 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                      {nft.details && (
                        <>
                          {/* Case: Aerodrome/Uniswap style liquidity position */}
                          {nft.details.token0Symbol && nft.details.token1Symbol && (
                            <>
                              <p className="font-semibold">Pool: {nft.details.token0Symbol}/{nft.details.token1Symbol}</p>
                              {nft.details.poolAddress && (
                                <p>
                                  Pool: {formatAddress(nft.details.poolAddress)}
                                  <a
                                    href={getExplorerLink(nft.details.poolAddress)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center ml-1 text-blue-500 hover:text-blue-700"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </p>
                              )}
                              {nft.details.priceRange && (
                                <p>Price Range: {nft.details.priceRange.lower} ↔ {nft.details.priceRange.upper}</p>
                              )}
                              {nft.details.token0 && (
                                <p>
                                  {nft.details.token0Symbol}: {formatAddress(nft.details.token0)}
                                  <a
                                    href={getExplorerLink(nft.details.token0)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center ml-1 text-blue-500 hover:text-blue-700"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </p>
                              )}
                              {nft.details.token1 && (
                                <p>
                                  {nft.details.token1Symbol}: {formatAddress(nft.details.token1)}
                                  <a
                                    href={getExplorerLink(nft.details.token1)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center ml-1 text-blue-500 hover:text-blue-700"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </p>
                              )}
                            </>
                          )}

                          {/* Case: Uniswap V3 position */}
                          {!nft.details.token0Symbol && nft.details.token0 && nft.details.token1 && (
                            <>
                              <p>Token Pair:</p>
                              <p>- {formatAddress(nft.details.token0)}</p>
                              <p>- {formatAddress(nft.details.token1)}</p>
                              {nft.details.fee !== undefined && (
                                <p>Fee Tier: {nft.details.fee / 10000}%</p>
                              )}
                              {nft.details.liquidity && (
                                <p>Liquidity: {formatTokenAmount(nft.details.liquidity, 18)}</p>
                              )}
                            </>
                          )}

                          {/* Generic NFT case */}
                          {nft.details.tokenId && !nft.details.token0 && !nft.details.token0Symbol && (
                            <>
                              <p>Token ID: {nft.details.tokenId}</p>
                              {nft.details.contractAddress && (
                                <p>
                                  Contract: {formatAddress(nft.details.contractAddress)}
                                  <a
                                    href={getExplorerLink(nft.details.contractAddress)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center ml-1 text-blue-500 hover:text-blue-700"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </p>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs space-y-1 text-gray-600">
                      {nft.details && (
                        <>
                          {nft.details.token0 && nft.details.token1 ? (
                            <>
                              <p>Token Pair: {`${nft.details.token0Symbol || nft.details.token0.slice(0,6)}...${nft.details.token0.slice(-4)} / ${nft.details.token1Symbol || nft.details.token1.slice(0,6)}...${nft.details.token1.slice(-4)}`}</p>
                              <p>Fee Tier: {nft.details.fee / 10000}%</p>
                              <p>Liquidity: {nft.details.liquidity}</p>
                            </>
                          ) : nft.details.tokenId ? (
                            <>
                              <p>Token ID: {nft.details.tokenId}</p>
                              {nft.details.token0Symbol && nft.details.token1Symbol && (
                                <p>Token Pair: {nft.details.token0Symbol}/{nft.details.token1Symbol}</p>
                              )}
                              {nft.details.lowerPrice && nft.details.upperPrice && (
                                <p>Price Range: {nft.details.lowerPrice} - {nft.details.upperPrice}</p>
                              )}
                              {nft.details.poolAddress ? (
                                <p>Pool: {formatAddress(nft.details.poolAddress)}</p>
                              ) : (
                                <p>Contract: {formatAddress(nft.details.contractAddress)}</p>
                              )}
                            </>
                          ) : (
                            <p>NFT Details Not Available</p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}