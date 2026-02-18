import { useEffect } from 'react';

/**
 * Hook zum Speichern und Wiederherstellen von Tab-States
 * Speichert den aktuellen aktiven Tab in localStorage
 * und stellt ihn beim Zurückkehren wieder her
 */
export function useTabStateRestoration(pageName, activeTab, setActiveTab) {
  const storageKey = `tab_state_${pageName}`;

  // Beim Mount: Versuche gespeicherten Tab zu laden
  useEffect(() => {
    const savedTab = localStorage.getItem(storageKey);
    if (savedTab) {
      setActiveTab(savedTab);
    }
  }, []); // Nur beim Mount einmal

  // Speichere Tab-State wenn er sich ändert
  useEffect(() => {
    if (activeTab) {
      localStorage.setItem(storageKey, activeTab);
    }
  }, [activeTab, storageKey]);

  return storageKey;
}