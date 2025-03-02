import { useQuery, useMutation } from "@tanstack/react-query";
import { useEthereum } from "@/hooks/use-ethereum";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type AutomationRule, type Position } from "@shared/schema";
import { Loader2 } from "lucide-react";

export function PositionAutomation({ position }: { position: Position }) {
  const { address } = useEthereum();
  const { toast } = useToast();

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["/api/wallet", address, "positions", position.id, "automation"],
    enabled: !!address && !!position.id,
  });

  const createRule = useMutation({
    mutationFn: async (rule: Omit<AutomationRule, "id" | "createdAt" | "updatedAt">) => {
      const res = await apiRequest("POST", `/api/wallet/${address}/automation`, rule);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/wallet", address, "positions", position.id, "automation"],
      });
      toast({
        title: "Automation Rule Created",
        description: "Your automation rule has been set up successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create automation rule.",
        variant: "destructive",
      });
    },
  });

  const toggleRule = useMutation({
    mutationFn: async ({ ruleId, enabled }: { ruleId: number; enabled: boolean }) => {
      const res = await apiRequest(
        "PATCH",
        `/api/wallet/${address}/automation/${ruleId}`,
        { isEnabled: enabled }
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/wallet", address, "positions", position.id, "automation"],
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Position Automation</CardTitle>
          <CardDescription>Automate your position management</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Position Automation</CardTitle>
        <CardDescription>Automate your position management</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div>
                <h4 className="font-medium capitalize">{rule.ruleType}</h4>
                <p className="text-sm text-muted-foreground">
                  Target: {rule.targetValue}
                </p>
              </div>
              <Switch
                checked={rule.isEnabled}
                onCheckedChange={(checked) =>
                  toggleRule.mutate({ ruleId: rule.id, enabled: checked })
                }
              />
            </div>
          ))}

          <div className="grid gap-4 rounded-lg border p-4">
            <h4 className="font-medium">Add New Rule</h4>
            <div className="grid gap-2">
              <Select
                onValueChange={(value) =>
                  createRule.mutate({
                    walletId: position.walletId,
                    positionId: position.id,
                    ruleType: value,
                    targetValue: "0",
                    isEnabled: true,
                    frequency: "on-trigger",
                    lastExecuted: null,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select rule type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rebalance">Auto Rebalance</SelectItem>
                  <SelectItem value="compound">Auto Compound</SelectItem>
                  <SelectItem value="stop-loss">Stop Loss</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
