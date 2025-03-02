
import React from 'react';
import { formatNumber, formatCurrency } from '../../lib/formatting';

interface PositionCardProps {
  position: {
    id: string;
    name: string;
    collectionName: string;
    details: {
      token0Symbol: string;
      token1Symbol: string;
      token0Amount?: string;
      token1Amount?: string;
      liquidity?: string;
      priceLower?: string;
      priceUpper?: string;
      fee?: string;
    }
  }
}

export function PositionCard({ position }: PositionCardProps) {
  // Format the numbers for display
  const token0Amount = formatNumber(position.details.token0Amount || '0', 6);
  const token1Amount = formatNumber(position.details.token1Amount || '0', 6);
  const liquidity = formatNumber(position.details.liquidity || '0', 0);
  
  return (
    <div className="bg-slate-800 rounded-lg p-4 mb-3 border border-slate-700 hover:border-blue-500 transition-all">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-lg font-medium text-white">{position.name}</h3>
          <p className="text-slate-400 text-sm">{position.collectionName}</p>
        </div>
        {position.details.fee && (
          <span className="bg-blue-900/50 text-blue-300 text-xs px-2 py-1 rounded">
            Fee: {Number(position.details.fee) / 10000}%
          </span>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="bg-slate-900 p-3 rounded">
          <p className="text-slate-400 text-xs mb-1">Token 0</p>
          <p className="text-white font-medium">{position.details.token0Symbol}</p>
          <p className="text-green-400">{token0Amount}</p>
        </div>
        <div className="bg-slate-900 p-3 rounded">
          <p className="text-slate-400 text-xs mb-1">Token 1</p>
          <p className="text-white font-medium">{position.details.token1Symbol}</p>
          <p className="text-green-400">{token1Amount}</p>
        </div>
      </div>
      
      <div className="mt-3 bg-slate-900 p-3 rounded">
        <p className="text-slate-400 text-xs mb-1">Price Range</p>
        <div className="flex justify-between">
          <div>
            <p className="text-xs text-slate-400">Lower</p>
            <p className="text-white">{formatNumber(position.details.priceLower || '0', 4)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-400">Liquidity</p>
            <p className="text-white">{liquidity}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Upper</p>
            <p className="text-white">{formatNumber(position.details.priceUpper || '0', 4)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

