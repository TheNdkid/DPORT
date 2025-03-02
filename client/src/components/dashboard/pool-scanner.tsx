import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, ArrowUpDown, Ticket, AlertCircle } from "lucide-react";
import { useEthereum } from "@/hooks/use-ethereum";
import { scanPools } from "@/services/pool-scanner";
import { NFTLPPositions } from "./nft-lp-positions";
import { DEX_ADDRESSES } from "@/services/pool-scanner";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UniswapV4Positions } from "./uniswap-v4-positions";

interface Pool {
  id: string;
  protocol: string;
  token0Symbol: string;
  token1Symbol: string;
  tvl: string;
  apr: string;
  volume24h: string;
  fee: number;
  priceRange?: {
    lower: string;
    upper: string;
  };
  isNFT?: boolean;
}

export function PoolScanner() {
  const { baseProvider } = useEthereum();
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [network, setNetwork] = useState<{ chainId: number; name: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Pool;
    direction: 'asc' | 'desc';
  }>({ key: 'tvl', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadPools = async (page: number, forceRefresh: boolean = false) => {
    try {
      setLoading(true);
      setError(null);

      if (!baseProvider) {
        throw new Error('Please connect your wallet to view liquidity pools');
      }

      const network = await baseProvider.getNetwork();
      const chainId = Number(network.chainId);

      if (chainId !== 8453 && chainId !== 84531) {
        throw new Error('Please switch to Base network to view liquidity pools. You can do this in your wallet settings.');
      }

      const result = await scanPools(baseProvider, page, forceRefresh);

      if (page === 1) {
        setPools(result.pools);
      } else {
        setPools(prev => [...prev, ...result.pools]);
      }

      setHasMore(result.hasMore);
    } catch (error) {
      console.error("Error scanning pools:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unable to load liquidity pools. Please try again later.';
      setError(errorMessage);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (baseProvider) {
      loadPools(1);
    }
  }, [baseProvider]);

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      setCurrentPage(prev => prev + 1);
      loadPools(currentPage + 1);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadPools(1, true);
  };

  const toggleRow = (poolId: string) => {
    const newExpandedRows = new Set(expandedRows);
    if (expandedRows.has(poolId)) {
      newExpandedRows.delete(poolId);
    } else {
      newExpandedRows.add(poolId);
    }
    setExpandedRows(newExpandedRows);
  };

  const checkNetwork = async () => {
    if (!baseProvider) return;
    try {
      const network = await baseProvider.getNetwork();
      setNetwork({
        chainId: Number(network.chainId),
        name: network.name
      });
    } catch (error) {
      console.error("Error checking network:", error);
      setError("Failed to detect network");
    }
  };

  const formatNumber = (num: string) => {
    const value = parseFloat(num);
    if (value >= 1e6) {
      return `$${(value / 1e6).toFixed(2)}M`;
    }
    if (value >= 1e3) {
      return `$${(value / 1e3).toFixed(2)}K`;
    }
    return `$${value.toFixed(2)}`;
  };

  const formatPrice = (price: string) => {
    return `$${parseFloat(price).toFixed(2)}`;
  };

  const handleSort = (key: keyof Pool) => {
    setSortConfig({
      key,
      direction:
        sortConfig.key === key && sortConfig.direction === 'asc'
          ? 'desc'
          : 'asc'
    });
  };

  const sortedPools = [...pools].sort((a, b) => {
    if (sortConfig.key === 'tvl' || sortConfig.key === 'volume24h') {
      return sortConfig.direction === 'asc'
        ? parseFloat(a[sortConfig.key]) - parseFloat(b[sortConfig.key])
        : parseFloat(b[sortConfig.key]) - parseFloat(a[sortConfig.key]);
    }
    return sortConfig.direction === 'asc'
      ? String(a[sortConfig.key]).localeCompare(String(b[sortConfig.key]))
      : String(b[sortConfig.key]).localeCompare(String(a[sortConfig.key]));
  });

  const filteredPools = sortedPools.filter(pool =>
    pool.token0Symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pool.token1Symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pool.protocol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <ErrorBoundary>
      <Card>
        <CardHeader>
          <CardTitle>Liquidity Pool Scanner</CardTitle>
          {network && (
            <div className="text-sm text-muted-foreground">
              Connected to: {network.name} (Chain ID: {network.chainId})
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by token or protocol..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={loading || isRefreshing}
              >
                {isRefreshing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Refreshing...
                  </>
                ) : (
                  'Refresh'
                )}
              </Button>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {error}
                  {error.includes('wallet') && (
                    <div className="mt-2 text-sm">
                      Make sure your wallet is:
                      <ul className="list-disc pl-5 mt-1">
                        <li>Connected to this site</li>
                        <li>Unlocked</li>
                        <li>Set to the Base network</li>
                      </ul>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <UniswapV4Positions />

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Protocol</TableHead>
                  <TableHead>Pool</TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort('tvl')}
                      className="flex items-center"
                    >
                      TVL
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort('apr')}
                      className="flex items-center"
                    >
                      APR
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort('volume24h')}
                      className="flex items-center"
                    >
                      24h Volume
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead>Position Range</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : filteredPools.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center">
                      {error ? 'Error loading pools' : 'No pools found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPools.map((pool) => (
                    <>
                      <TableRow
                        key={pool.id}
                        className="cursor-pointer"
                        onClick={() => pool.isNFT && toggleRow(pool.id)}
                      >
                        <TableCell>{pool.protocol}</TableCell>
                        <TableCell className="flex items-center gap-2">
                          {pool.isNFT && <Ticket className="h-4 w-4 text-purple-500" />}
                          {pool.token0Symbol}/{pool.token1Symbol}
                        </TableCell>
                        <TableCell>{formatNumber(pool.tvl)}</TableCell>
                        <TableCell>{parseFloat(pool.apr).toFixed(2)}%</TableCell>
                        <TableCell>{formatNumber(pool.volume24h)}</TableCell>
                        <TableCell>{pool.fee}%</TableCell>
                        <TableCell>
                          {pool.priceRange ? (
                            <span className={`text-xs ${pool.isNFT ? 'text-purple-600 font-medium' : ''}`}>
                              {formatPrice(pool.priceRange.lower)} - {formatPrice(pool.priceRange.upper)}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={pool.isNFT ? "text-purple-600 font-medium" : "text-gray-600"}>
                            {pool.isNFT ? "NFT Position" : "Standard LP"}
                          </span>
                        </TableCell>
                      </TableRow>
                      {pool.isNFT && expandedRows.has(pool.id) && (
                        <TableRow>
                          <TableCell colSpan={8} className="bg-purple-50/50 p-0">
                            <NFTLPPositions
                              poolAddress={pool.id}
                              protocol={pool.protocol}
                              positionManagerAddress={
                                pool.protocol === "Uniswap V3"
                                  ? DEX_ADDRESSES.uniswap.positionManager
                                  : DEX_ADDRESSES.aerodrome.positionManager
                              }
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))
                )}
              </TableBody>
            </Table>

            {hasMore && (
              <div className="mt-4 flex justify-center">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load More'
                  )}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </ErrorBoundary>
  );
}