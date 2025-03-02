
import React from 'react';
import { PositionCard } from './position-card';

interface PositionListProps {
  positions: any[];
  isLoading?: boolean;
  error?: string | null;
}

export function PositionList({ positions, isLoading, error }: PositionListProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800 text-red-200 p-4 rounded-lg">
        <p className="font-medium">Error loading positions</p>
        <p className="text-sm opacity-80">{error}</p>
      </div>
    );
  }
  
  if (!positions || positions.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 text-center border border-slate-700">
        <p className="text-slate-400">No positions found</p>
        <p className="text-sm text-slate-500 mt-1">Connect a wallet with Aerodrome Slipstream positions</p>
      </div>
    );
  }
  
  return (
    <div>
      {positions.map(position => (
        <PositionCard key={position.id} position={position} />
      ))}
    </div>
  );
}

