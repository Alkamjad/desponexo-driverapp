import { useEffect, useRef } from 'react';

export function useScrollRestoration(pageName) {
  const scrollRef = useRef(null);
  const scrollPosKey = `scroll_pos_${pageName}`;

  useEffect(() => {
    // Stelle Scroll-Position wieder her wenn Seite geladen wird
    const savedPos = sessionStorage.getItem(scrollPosKey);
    if (scrollRef.current && savedPos) {
      setTimeout(() => {
        scrollRef.current.scrollTop = parseInt(savedPos, 10);
      }, 0);
    }

    // Speichere Scroll-Position beim Unmount
    const handleBeforeUnload = () => {
      if (scrollRef.current) {
        sessionStorage.setItem(scrollPosKey, scrollRef.current.scrollTop);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (scrollRef.current) {
        sessionStorage.setItem(scrollPosKey, scrollRef.current.scrollTop);
      }
    };
  }, [pageName, scrollPosKey]);

  return scrollRef;
}