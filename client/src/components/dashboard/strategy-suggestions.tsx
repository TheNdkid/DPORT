import { useQuery } from "@tanstack/react-query";
import { useEthereum } from "@/hooks/use-ethereum";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { type Strategy } from "@shared/schema";

const getRiskBadgeColor = (risk: string) => {
  switch (risk.toLowerCase()) {
    case "low":
      return "bg-green-500/10 text-green-500";
    case "medium":
      return "bg-yellow-500/10 text-yellow-500";
    case "high":
      return "bg-red-500/10 text-red-500";
    default:
      return "bg-gray-500/10 text-gray-500";
  }
};

export function StrategyCard({ strategy }: { strategy: Strategy }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{strategy.title}</CardTitle>
          <Badge
            variant="outline"
            className={getRiskBadgeColor(strategy.riskLevel)}
          >
            {strategy.riskLevel} Risk
          </Badge>
        </div>
        <CardDescription>{strategy.protocol}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{strategy.description}</p>
          <div className="flex justify-between text-sm">
            <span>Expected APY:</span>
            <span className="font-medium text-green-500">
              {Number(strategy.expectedApy).toFixed(2)}%
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {strategy.requiredAssets.map((asset) => (
              <Badge key={asset} variant="secondary">
                {asset}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function StrategySuggestions() {
  const { address } = useEthereum();

  const { data: strategies, isLoading } = useQuery({
    queryKey: ["/api/wallet", address, "strategies"],
    enabled: !!address,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Strategy Suggestions</CardTitle>
          <CardDescription>
            Personalized DeFi strategies based on your portfolio
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Strategy Suggestions</CardTitle>
        <CardDescription>
          Personalized DeFi strategies based on your portfolio
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {strategies?.map((strategy) => (
            <StrategyCard key={strategy.id} strategy={strategy} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
