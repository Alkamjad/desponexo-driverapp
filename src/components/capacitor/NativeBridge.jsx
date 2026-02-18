// Native Bridge für iOS/Android Capacitor Features
import { Capacitor } from '@capacitor/core';

// Lazy plugin accessors to avoid bundling missing plugins
const getPlugin = (name) => (typeof window !== 'undefined' && window.Capacitor?.Plugins?.[name]) || null;
const Geolocation = getPlugin('Geolocation');
const Camera = getPlugin('Camera');
const PushNotifications = getPlugin('PushNotifications');
const LocalNotifications = getPlugin('LocalNotifications');
const Haptics = getPlugin('Haptics');
const Network = getPlugin('Network');
const Filesystem = getPlugin('Filesystem');

// Fallback constants (web/no-op)
const CameraResultType = { Base64: 'base64' };
const CameraSource = { Camera: 'camera', Photos: 'photos' };
const ImpactStyle = { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' };
const Directory = { Documents: 'DOCUMENTS' };
const Encoding = { UTF8: 'utf8' };

// Check if running on native platform
export const isNative = () => {
  return Capacitor.isNativePlatform();
};

export const getPlatform = () => {
  return Capacitor.getPlatform(); // 'ios', 'android', 'web'
};

// ========================================
// GPS / GEOLOCATION
// ========================================
export const requestLocationPermissions = async () => {
  try {
    const permission = await Geolocation.requestPermissions();
    return permission.location === 'granted';
  } catch (error) {
    console.error('Location permission error:', error);
    return false;
  }
};

export const getCurrentPosition = async () => {
  try {
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });
    
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude,
      speed: position.coords.speed,
      heading: position.coords.heading,
      timestamp: position.timestamp
    };
  } catch (error) {
    console.error('Get position error:', error);
    throw error;
  }
};

export const watchPosition = (callback) => {
  const geo = Geolocation;
  if (!geo?.watchPosition) {
    // Plugin nicht verfügbar → No-Op Cleanup
    return () => {};
  }
  const watchId = geo.watchPosition({
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0
  }, (position, err) => {
    if (err) {
      console.error('Watch position error:', err);
      return;
    }
    callback({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp
    });
  });
  return () => {
    try { geo.clearWatch({ id: watchId }); } catch (_) {}
  };
};

// ========================================
// CAMERA
// ========================================
export const takePhoto = async () => {
  try {
    const image = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Camera,
      correctOrientation: true
    });
    
    return {
      base64: image.base64String,
      format: image.format,
      dataUrl: `data:image/${image.format};base64,${image.base64String}`
    };
  } catch (error) {
    console.error('Camera error:', error);
    throw error;
  }
};

export const pickImage = async () => {
  try {
    const image = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Photos
    });
    
    return {
      base64: image.base64String,
      format: image.format,
      dataUrl: `data:image/${image.format};base64,${image.base64String}`
    };
  } catch (error) {
    console.error('Image picker error:', error);
    throw error;
  }
};

// ========================================
// PUSH NOTIFICATIONS
// ========================================
export const registerPushNotifications = async () => {
  if (!isNative()) return null;
  
  try {
    let permStatus = await PushNotifications.checkPermissions();
    
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }
    
    if (permStatus.receive !== 'granted') {
      throw new Error('Push notification permission denied');
    }
    
    await PushNotifications.register();
    
    return new Promise((resolve) => {
      PushNotifications.addListener('registration', (token) => {
        resolve(token.value);
      });
      
      PushNotifications.addListener('registrationError', (error) => {
        console.error('Push registration error:', error);
        resolve(null);
      });
    });
  } catch (error) {
    console.error('Push notifications error:', error);
    return null;
  }
};

export const onPushNotificationReceived = (callback) => {
  if (!isNative()) return () => {};
  
  const listener = PushNotifications.addListener('pushNotificationReceived', callback);
  return () => listener.remove();
};

export const onPushNotificationAction = (callback) => {
  if (!isNative()) return () => {};
  
  const listener = PushNotifications.addListener('pushNotificationActionPerformed', callback);
  return () => listener.remove();
};

// ========================================
// LOCAL NOTIFICATIONS
// ========================================
export const scheduleLocalNotification = async (options) => {
  try {
    await LocalNotifications.schedule({
      notifications: [{
        id: options.id || Date.now(),
        title: options.title,
        body: options.body,
        schedule: options.schedule || undefined,
        sound: 'default',
        actionTypeId: options.actionTypeId || '',
        extra: options.data || {}
      }]
    });
  } catch (error) {
    console.error('Local notification error:', error);
  }
};

// ========================================
// HAPTICS (Vibration)
// ========================================
export const hapticImpact = async (style = ImpactStyle.Medium) => {
  if (!isNative()) return;
  
  try {
    await Haptics.impact({ style });
  } catch (error) {
    console.error('Haptics error:', error);
  }
};

export const hapticNotification = async (type = 'SUCCESS') => {
  if (!isNative()) return;
  
  try {
    await Haptics.notification({ type });
  } catch (error) {
    console.error('Haptics error:', error);
  }
};

// ========================================
// NETWORK STATUS
// ========================================
export const getNetworkStatus = async () => {
  try {
    const status = await Network.getStatus();
    return {
      connected: status.connected,
      connectionType: status.connectionType
    };
  } catch (error) {
    console.error('Network status error:', error);
    return { connected: navigator.onLine, connectionType: 'unknown' };
  }
};

export const onNetworkChange = (callback) => {
  if (!isNative()) {
    window.addEventListener('online', () => callback({ connected: true }));
    window.addEventListener('offline', () => callback({ connected: false }));
    return () => {
      window.removeEventListener('online', callback);
      window.removeEventListener('offline', callback);
    };
  }
  
  const listener = Network.addListener('networkStatusChange', callback);
  return () => listener.remove();
};

// ========================================
// FILE SYSTEM
// ========================================
export const saveFile = async (fileName, data, encoding = Encoding.UTF8) => {
  try {
    const result = await Filesystem.writeFile({
      path: fileName,
      data: data,
      directory: Directory.Documents,
      encoding: encoding
    });
    
    return result.uri;
  } catch (error) {
    console.error('File save error:', error);
    throw error;
  }
};

export const readFile = async (fileName, encoding = Encoding.UTF8) => {
  try {
    const result = await Filesystem.readFile({
      path: fileName,
      directory: Directory.Documents,
      encoding: encoding
    });
    
    return result.data;
  } catch (error) {
    console.error('File read error:', error);
    throw error;
  }
};

export const deleteFile = async (fileName) => {
  try {
    await Filesystem.deleteFile({
      path: fileName,
      directory: Directory.Documents
    });
  } catch (error) {
    console.error('File delete error:', error);
    throw error;
  }
};

// ========================================
// UTILITY FUNCTIONS
// ========================================
export const openAppSettings = async () => {
  // Nutzer zu App-Einstellungen führen (für Permissions)
  if (isNative() && getPlatform() === 'ios') {
    window.open('app-settings:');
  }
};

export default {
  isNative,
  getPlatform,
  requestLocationPermissions,
  getCurrentPosition,
  watchPosition,
  takePhoto,
  pickImage,
  registerPushNotifications,
  onPushNotificationReceived,
  onPushNotificationAction,
  scheduleLocalNotification,
  hapticImpact,
  hapticNotification,
  getNetworkStatus,
  onNetworkChange,
  saveFile,
  readFile,
  deleteFile,
  openAppSettings
};