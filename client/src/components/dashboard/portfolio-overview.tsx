import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { useEthereum } from "@/hooks/use-ethereum";
import { Skeleton } from "@/components/ui/skeleton";

export function PortfolioOverview() {
  const { address } = useEthereum();

  const { data: assets, isLoading } = useQuery({
    queryKey: ["/api/wallet", address, "assets"],
    enabled: !!address
  });

  const totalValue = assets?.reduce((sum, asset) => sum + Number(asset.usdValue), 0) || 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Overview</CardTitle>
          <CardDescription>Your total asset value</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio Overview</CardTitle>
        <CardDescription>Your total asset value</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-4xl font-bold">${totalValue.toLocaleString()}</div>
      </CardContent>
    </Card>
  );
}
