import { offlineManager } from '@/components/OfflineManager';
import { callFunction } from '@/components/utils/callFunction';

export const tourService = {
  async updateTourStatus(tourId, status, additionalData = {}) {
    try {
      if (!tourId) return { error: 'No tourId' };

      const now = new Date().toISOString();

      if (!navigator.onLine) {
        await offlineManager.updateTour(tourId, {
          status,
          updated_at: now,
          ...additionalData
        });

        await offlineManager.queueStatusUpdate(tourId, status, additionalData);

        return {
          success: true,
          offline: true,
          tour: await offlineManager.getTours().then(tours =>
            tours.find(t => t.id === tourId)
          )
        };
      }

      const result = await callFunction('updateTourStatus', {
        tour_id: tourId,
        status,
        ...additionalData
      });

      return {
        success: true,
        tour: result.tour
      };

    } catch (error) {
      return { error: error.message };
    }
  },

  async updateTourStops(tourId, updatedStops) {
    try {
      if (!tourId || !updatedStops) {
        return { success: false, error: 'Missing tourId or stops' };
      }

      const result = await callFunction('updateTourStops', {
        tour_id: tourId,
        stops: updatedStops
      });

      if (!result?.success || !result?.tour) {
        console.error('❌ updateTourStops failed:', result);
        return { success: false, error: result?.error || 'Backend returned no tour' };
      }

      return {
        success: true,
        tour: result.tour
      };

    } catch (error) {
      console.error('❌ updateTourStops exception:', error);
      return { success: false, error: error.message };
    }
  }
};

export default tourService;
