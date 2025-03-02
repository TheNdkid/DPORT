import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function RiskMetrics() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Risk Metrics
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Basic risk assessment of your portfolio</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm font-medium text-muted-foreground">
              Portfolio Diversity
            </div>
            <div className="text-2xl font-bold">Medium</div>
          </div>
          <div>
            <div className="text-sm font-medium text-muted-foreground">
              Risk Score
            </div>
            <div className="text-2xl font-bold">6.5/10</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
