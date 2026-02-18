/**
 * Komprimiert ein Bild auf eine maximale Größe
 * @param {File} file - Die Bilddatei
 * @param {Object} options - Komprimierungsoptionen
 * @returns {Promise<File>} - Die komprimierte Datei
 */
export async function compressImage(file, options = {}) {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.8,
    maxSizeMB = 1
  } = options;

  // Wenn Datei bereits klein genug ist
  if (file.size / 1024 / 1024 < maxSizeMB) {
    console.log('✅ Image already small enough:', (file.size / 1024).toFixed(0), 'KB');
    return file;
  }

  console.log('🔄 Compressing image:', (file.size / 1024).toFixed(0), 'KB');

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        // Berechne neue Dimensionen
        let { width, height } = img;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
        
        // Canvas erstellen
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Zu Blob konvertieren
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Compression failed'));
              return;
            }
            
            // Neues File-Objekt erstellen
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            
            console.log('✅ Compressed:', 
              (file.size / 1024).toFixed(0), 'KB →', 
              (compressedFile.size / 1024).toFixed(0), 'KB',
              '(' + ((1 - compressedFile.size / file.size) * 100).toFixed(0) + '% kleiner)'
            );
            
            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };
      
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = e.target.result;
    };
    
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

/**
 * Komprimiert mehrere Bilder parallel
 */
export async function compressImages(files, options) {
  return Promise.all(
    Array.from(files).map(file => compressImage(file, options))
  );
}