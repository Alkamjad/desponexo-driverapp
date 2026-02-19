// authClient.js - Kompatibilitäts-Fassade für bestehende Importe
import { authService } from '@/services/authService';
import { tourService } from '@/services/tourService';

export const authClient = {
  // Login über Supabase Auth
  async loginDriver(email, password, invitation_token = null) {
    return authService.loginDriver(email, password, invitation_token);
  },

  // Tour Status aktualisieren
  async updateTourStatus(tourId, status, additionalData = {}) {
    return tourService.updateTourStatus(tourId, status, additionalData);
  },

  // Multi-Stop Tour: Update einzelner Stop
  async updateTourStops(tourId, updatedStops) {
    return tourService.updateTourStops(tourId, updatedStops);
  }
};

export default authClient;
