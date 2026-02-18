import { useEffect, useRef, useState } from 'react';

/**
 * Hook für native Pull-to-Refresh Gesten
 * Funktioniert wie iOS/Android native
 */
export function usePullToRefresh(onRefresh, scrollRef) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);
  const scrollTop = useRef(0);

  useEffect(() => {
    const element = scrollRef?.current;
    if (!element) return;

    const handleTouchStart = (e) => {
      touchStartY.current = e.touches[0].clientY;
      scrollTop.current = element.scrollTop;
    };

    const handleTouchMove = (e) => {
      // Nur wenn am top
      if (scrollTop.current !== 0 || isRefreshing) return;

      const touchY = e.touches[0].clientY;
      const distance = touchY - touchStartY.current;

      // Nur nach unten ziehen
      if (distance > 0) {
        setPullDistance(Math.min(distance, 120)); // Max 120px
      }
    };

    const handleTouchEnd = async () => {
      // Threshold: 60px zum triggern
      if (pullDistance > 60 && !isRefreshing) {
        setIsRefreshing(true);
        try {
          await onRefresh?.();
        } finally {
          setIsRefreshing(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
      }
    };

    element.addEventListener('touchstart', handleTouchStart, false);
    element.addEventListener('touchmove', handleTouchMove, false);
    element.addEventListener('touchend', handleTouchEnd, false);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pullDistance, isRefreshing, onRefresh, scrollRef]);

  return { isRefreshing, pullDistance };
}