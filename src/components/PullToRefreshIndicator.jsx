import React from 'react';
import { RefreshCw } from 'lucide-react';

export default function PullToRefreshIndicator({ distance, isRefreshing }) {
  const rotation = Math.min(distance * 3, 360);
  const opacity = Math.min(distance / 60, 1);

  return (
    <div 
      className="fixed top-0 left-0 right-0 flex justify-center items-start pointer-events-none z-40"
      style={{ transform: `translateY(${Math.max(distance - 40, 0)}px)` }}
    >
      <div 
        className="mt-4 transition-opacity"
        style={{ opacity }}
      >
        <div className="flex flex-col items-center">
          <div 
            className="p-3 bg-emerald-500/20 rounded-full"
            style={{ 
              transform: isRefreshing ? 'rotate(0deg)' : `rotate(${rotation}deg)`,
              transition: isRefreshing ? 'transform 0.6s linear infinite' : 'transform 0.1s ease-out'
            }}
          >
            <RefreshCw className="w-5 h-5 text-emerald-400" />
          </div>
          {distance > 60 && !isRefreshing && (
            <p className="text-xs text-emerald-400 mt-2 font-medium">Loslassen zum Aktualisieren</p>
          )}
          {isRefreshing && (
            <p className="text-xs text-emerald-400 mt-2 font-medium">Wird aktualisiert...</p>
          )}
        </div>
      </div>
    </div>
  );
}