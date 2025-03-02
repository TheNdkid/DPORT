import { useEthereum } from "@/hooks/use-ethereum";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export function WalletAssets() {
  const { assets, assetsLoading } = useEthereum();

  if (assetsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Wallet Assets</CardTitle>
          <CardDescription>Your current token holdings</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wallet Assets</CardTitle>
        <CardDescription>Your current token holdings</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Token</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead className="text-right">Value (USD)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets?.map((asset) => (
              <TableRow key={asset.symbol}>
                <TableCell className="font-medium">{asset.symbol}</TableCell>
                <TableCell>{Number(asset.balance).toFixed(4)}</TableCell>
                <TableCell className="text-right">
                  ${Number(asset.usdValue).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}