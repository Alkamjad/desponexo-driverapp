// IndexedDB Manager für Offline-Speicherung
const DB_NAME = 'DespoNexoDriver';
const DB_VERSION = 1;
const TOURS_STORE = 'tours';
const QUEUE_STORE = 'sync_queue';

class OfflineManager {
  constructor() {
    this.db = null;
  }

  // Datenbank initialisieren
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Tours Store
        if (!db.objectStoreNames.contains(TOURS_STORE)) {
          const toursStore = db.createObjectStore(TOURS_STORE, { keyPath: 'id' });
          toursStore.createIndex('status', 'status', { unique: false });
          toursStore.createIndex('tour_date', 'tour_date', { unique: false });
        }

        // Sync Queue Store
        if (!db.objectStoreNames.contains(QUEUE_STORE)) {
          const queueStore = db.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
          queueStore.createIndex('timestamp', 'timestamp', { unique: false });
          queueStore.createIndex('type', 'type', { unique: false });
        }
      };
    });
  }

  // Tours speichern (nur für aktuellen Fahrer)
  async saveTours(tours) {
    if (!this.db) await this.init();
    
    const driverId = localStorage.getItem('driver_id');
    if (!driverId) return;

    // ERST alten Cache löschen, dann neue Touren speichern
    const transaction = this.db.transaction([TOURS_STORE], 'readwrite');
    const store = transaction.objectStore(TOURS_STORE);
    
    // Lösche ALLE alten Touren
    store.clear();

    // Speichere nur Touren des aktuellen Fahrers
    for (const tour of tours) {
      store.put({
        ...tour,
        cached_at: new Date().toISOString(),
        cached_for_driver: driverId
      });
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // Tours laden (nur für aktuellen Fahrer)
  async getTours() {
    if (!this.db) await this.init();

    const driverId = localStorage.getItem('driver_id');

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([TOURS_STORE], 'readonly');
      const store = transaction.objectStore(TOURS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const allTours = request.result || [];
        // Filtere nur Touren für aktuellen Fahrer
        const filteredTours = driverId 
          ? allTours.filter(t => t.cached_for_driver === driverId)
          : allTours;
        resolve(filteredTours);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Einzelne Tour aktualisieren (lokal)
  async updateTour(tourId, updates) {
    if (!this.db) await this.init();

    const transaction = this.db.transaction([TOURS_STORE], 'readwrite');
    const store = transaction.objectStore(TOURS_STORE);
    const getRequest = store.get(tourId);

    return new Promise((resolve, reject) => {
      getRequest.onsuccess = () => {
        const tour = getRequest.result;
        if (tour) {
          const updatedTour = { ...tour, ...updates, updated_at: new Date().toISOString() };
          store.put(updatedTour);
          resolve(updatedTour);
        } else {
          reject(new Error('Tour nicht gefunden'));
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // Status-Update in Queue speichern (für Sync)
  async queueStatusUpdate(tourId, status, additionalData = {}) {
    if (!this.db) await this.init();

    const transaction = this.db.transaction([QUEUE_STORE], 'readwrite');
    const store = transaction.objectStore(QUEUE_STORE);

    const queueItem = {
      type: 'status_update',
      tourId,
      status,
      additionalData,
      timestamp: new Date().toISOString(),
      synced: false
    };

    const request = store.add(queueItem);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Beliebiges Item zur Sync-Queue hinzufügen
  async addToSyncQueue(item) {
    if (!this.db) await this.init();

    const transaction = this.db.transaction([QUEUE_STORE], 'readwrite');
    const store = transaction.objectStore(QUEUE_STORE);

    const queueItem = {
      ...item,
      timestamp: item.timestamp || new Date().toISOString(),
      synced: false
    };

    const request = store.add(queueItem);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Queue-Länge abrufen
  async getQueueCount() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([QUEUE_STORE], 'readonly');
      const store = transaction.objectStore(QUEUE_STORE);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Sync Queue laden
  async getSyncQueue() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([QUEUE_STORE], 'readonly');
      const store = transaction.objectStore(QUEUE_STORE);
      const index = store.index('timestamp');
      const request = index.getAll();

      request.onsuccess = () => {
        const items = request.result || [];
        resolve(items.filter(item => !item.synced));
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Queue-Item als synchronisiert markieren
  async markAsSynced(queueId) {
    if (!this.db) await this.init();

    const transaction = this.db.transaction([QUEUE_STORE], 'readwrite');
    const store = transaction.objectStore(QUEUE_STORE);
    
    return new Promise((resolve, reject) => {
      const getRequest = store.get(queueId);
      
      getRequest.onsuccess = () => {
        const item = getRequest.result;
        if (item) {
          item.synced = true;
          item.synced_at = new Date().toISOString();
          store.put(item);
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // Queue-Item löschen
  async deleteQueueItem(queueId) {
    if (!this.db) await this.init();

    const transaction = this.db.transaction([QUEUE_STORE], 'readwrite');
    const store = transaction.objectStore(QUEUE_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.delete(queueId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Cache leeren
  async clearCache() {
    if (!this.db) await this.init();

    const transaction = this.db.transaction([TOURS_STORE, QUEUE_STORE], 'readwrite');
    transaction.objectStore(TOURS_STORE).clear();
    transaction.objectStore(QUEUE_STORE).clear();

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
}

// Singleton Instance
export const offlineManager = new OfflineManager();