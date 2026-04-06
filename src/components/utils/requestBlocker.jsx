// Global Request Blocker - prevents unwanted API calls
// Dieser Code wird automatisch beim App-Start ausgeführt

// Block fetch requests
const originalFetch = window.fetch;
window.fetch = function(...args) {
  const url = args[0];
  
  if (typeof url === 'string') {
    if (url.includes('base44.cloud') || 
        url.includes('qtrypzzcjebvfcihiynt') ||
        url.includes('/api/base44/') ||
        url.includes('base44-prod')) {
      return Promise.resolve(new Response(JSON.stringify({ blocked: true })));
    }
  }
  
  return originalFetch.apply(this, args);
};

// Suppress console errors
const originalError = console.error;
console.error = function(...args) {
  const message = args[0]?.toString() || '';
  if (message.includes('base44') || 
      message.includes('Base44') ||
      message.includes('qtrypzzcjebvfcihiynt')) {
    return;
  }
  originalError.apply(console, args);
};

// Suppress console warnings
const originalWarn = console.warn;
console.warn = function(...args) {
  const message = args[0]?.toString() || '';
  if (message.includes('base44') || 
      message.includes('Base44') ||
      message.includes('Supabase client') ||
      message.includes('multiple instances') ||
      message.includes('SelectPrimitive.Portal')) {
    return;
  }
  originalWarn.apply(console, args);
};

// Handle resource loading errors
window.addEventListener('error', function(e) {
  if (e.message && (
    e.message.includes('base44') || 
    e.message.includes('Base44') ||
    e.message.includes('401') ||
    e.message.includes('404') ||
    e.filename?.includes('base44')
  )) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }
}, true);

// Block image loading errors
const OriginalImage = window.Image;
window.Image = function() {
  const img = new OriginalImage();
  const originalSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  
  Object.defineProperty(img, 'src', {
    get: function() {
      return originalSrc.get.call(this);
    },
    set: function(value) {
      if (value && (
        value.includes('base44') || 
        value.includes('qtrypzzcjebvfcihiynt') ||
        value.includes('01b6313bf_16897')
      )) {
        img.onerror = null;
        return;
      }
      originalSrc.set.call(this, value);
    }
  });
  
  return img;
};