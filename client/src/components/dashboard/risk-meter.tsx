import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Position } from "@/shared/types";

interface RiskMeterProps {
  position: Position;
}

export function RiskMeter({ position }: RiskMeterProps) {
  const [score, setScore] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // Start animation when component mounts
    setIsAnimating(true);
    
    // Calculate health score
    const healthScore = calculateHealthScore(position);
    setScore(healthScore);

    // Reset animation flag after transition
    const timer = setTimeout(() => {
      setIsAnimating(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [position]);

  const calculateHealthScore = (position: Position): number => {
    // Initial basic scoring logic
    let score = 100; // Start with perfect health

    if (position.priceRange) {
      const currentPrice = 2500; // TODO: Get real price
      const lower = parseFloat(position.priceRange.lower);
      const upper = parseFloat(position.priceRange.upper);
      
      // If price is outside range, reduce score
      if (currentPrice < lower || currentPrice > upper) {
        score -= 30;
      }
      
      // If price is close to boundaries, reduce score
      const rangeSize = upper - lower;
      const lowerBuffer = lower + (rangeSize * 0.1);
      const upperBuffer = upper - (rangeSize * 0.1);
      
      if (currentPrice < lowerBuffer || currentPrice > upperBuffer) {
        score -= 15;
      }
    }

    return Math.max(0, Math.min(100, score));
  };

  const getRiskLevel = (score: number): string => {
    if (score >= 70) return "Low Risk";
    if (score >= 40) return "Medium Risk";
    return "High Risk";
  };

  const getRiskColor = (score: number): string => {
    if (score >= 70) return "bg-green-500";
    if (score >= 40) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Position Health</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Score Display */}
          <div className="text-center">
            <span className="text-4xl font-bold">{score}</span>
            <span className="text-2xl font-light">/100</span>
          </div>
          
          {/* Risk Level */}
          <div className="text-center text-lg font-medium">
            {getRiskLevel(score)}
          </div>
          
          {/* Animated Meter */}
          <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`absolute h-full ${getRiskColor(score)} transition-all duration-1000 ease-out`}
              style={{
                width: `${score}%`,
                transform: isAnimating ? 'translateX(0)' : 'translateX(-100%)'
              }}
            />
          </div>
          
          {/* Risk Indicators */}
          <div className="flex justify-between text-sm text-gray-500">
            <span>High Risk</span>
            <span>Medium Risk</span>
            <span>Low Risk</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
