/**
 * File validation utilities optimized for OCR processing
 * Since images are not stored, validation focuses on OCR compatibility and memory safety
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
  metadata?: {
    width?: number;
    height?: number;
    size?: number;
    format?: string;
  };
}

export interface OCRValidationLimits {
  MAX_FILE_SIZE: number;      // 5MB
  MAX_WIDTH: number;         // Reasonable OCR limit
  MAX_HEIGHT: number;
  MAX_PIXEL_COUNT: number;   // Total pixels for memory safety
  OCR_SUPPORTED_FORMATS: string[];
  LOAD_TIMEOUT: number;
}

// OCR-focused limits (not storage limits)
export const OCR_LIMITS: OCRValidationLimits = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB - balances quality vs processing time
  MAX_WIDTH: 4096,                // Prevents extreme OCR processing times
  MAX_HEIGHT: 4096,
  MAX_PIXEL_COUNT: 16 * 1024 * 1024, // ~16MP - manageable for OCR
  OCR_SUPPORTED_FORMATS: [
    'image/jpeg',     // Best OCR performance
    'image/jpg',      // JPG with different extension
    'image/png',      // Good OCR support with text
    // Note: WebP excluded due to limited OCR engine support
  ],
  LOAD_TIMEOUT: 5000, // 5 seconds to load image
};

/**
 * Client-side validation: Basic image loadability check
 * Ensures the image can be loaded and displayed before sending to OCR
 */
export const validateImageForOCR = (file: File): Promise<ValidationResult> => {
  return new Promise((resolve) => {
    // Basic file checks first
    if (!OCR_LIMITS.OCR_SUPPORTED_FORMATS.includes(file.type)) {
      resolve({
        valid: false,
        error: `Unsupported format. Use JPG or PNG for best OCR results.`
      });
      return;
    }

    if (file.size > OCR_LIMITS.MAX_FILE_SIZE) {
      resolve({
        valid: false,
        error: `File too large (${Math.round(file.size / 1024 / 1024)}MB). Maximum 5MB for OCR processing.`
      });
      return;
    }

    // Create image element to test loadability
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    // Set timeout for slow/corrupted files
    const timeoutId = setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        valid: false,
        error: 'Image loading timeout. File may be corrupted or too large.'
      });
    }, OCR_LIMITS.LOAD_TIMEOUT);

    img.onload = () => {
      clearTimeout(timeoutId);
      URL.revokeObjectURL(objectUrl);

      // Check dimensions for OCR compatibility
      const pixelCount = img.naturalWidth * img.naturalHeight;

      if (pixelCount > OCR_LIMITS.MAX_PIXEL_COUNT) {
        resolve({
          valid: false,
          error: `Image too high resolution (${img.naturalWidth}x${img.naturalHeight}). Maximum 16MP for OCR.`
        });
        return;
      }

      if (img.naturalWidth > OCR_LIMITS.MAX_WIDTH || img.naturalHeight > OCR_LIMITS.MAX_HEIGHT) {
        resolve({
          valid: false,
          error: `Image dimensions too large (${img.naturalWidth}x${img.naturalHeight}). Maximum 4096x4096 pixels.`
        });
        return;
      }

      // Image is valid for OCR processing
      resolve({
        valid: true,
        metadata: {
          width: img.naturalWidth,
          height: img.naturalHeight,
          size: file.size,
          format: file.type
        }
      });
    };

    img.onerror = () => {
      clearTimeout(timeoutId);
      URL.revokeObjectURL(objectUrl);
      resolve({
        valid: false,
        error: 'Invalid image file. Cannot load for OCR processing.'
      });
    };

    img.src = objectUrl;
  });
};

/**
 * Server-side validation for OCR processing
 * Validates base64 image data before sending to OCR engine
 */
export const validateBase64ImageForOCR = async (base64Data: string): Promise<ValidationResult> => {
  try {
    // Extract data from base64 (remove data:image/jpeg;base64, prefix)
    const base64Content = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

    if (!base64Content) {
      return { valid: false, error: 'Invalid base64 image data' };
    }

    // Convert to buffer
    const buffer = Buffer.from(base64Content, 'base64');

    // Size check
    if (buffer.length > OCR_LIMITS.MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `Image too large (${Math.round(buffer.length / 1024 / 1024)}MB) for OCR processing`
      };
    }

    // For server-side, we'll do basic buffer validation
    // More advanced dimension checking would require additional libraries like sharp

    // Check if it's actually image data by checking magic bytes
    const magicBytes = buffer.subarray(0, 8);
    const isJPEG = magicBytes[0] === 0xFF && magicBytes[1] === 0xD8;
    const isPNG = magicBytes[0] === 0x89 && magicBytes[1] === 0x50 &&
                  magicBytes[2] === 0x4E && magicBytes[3] === 0x47;

    if (!isJPEG && !isPNG) {
      return { valid: false, error: 'Not a valid JPEG or PNG image' };
    }

    return { valid: true };

  } catch (error) {
    console.error('Error validating base64 image:', error);
    return {
      valid: false,
      error: 'Cannot process image data for OCR'
    };
  }
};

/**
 * Checks if file extension matches OCR-compatible formats
 */
export const isOCRCompatibleExtension = (filename: string): boolean => {
  const extension = filename.toLowerCase().split('.').pop();
  const compatibleExtensions = ['jpg', 'jpeg', 'png'];
  return compatibleExtensions.includes(extension || '');
};

/**
 * Get user-friendly error message for common OCR issues
 */
export const getOCRErrorMessage = (error: string): string => {
  if (error.includes('too large')) {
    return 'Try a smaller image (under 5MB) or lower resolution';
  }
  if (error.includes('dimensions')) {
    return 'Resize image to under 4096x4096 pixels for OCR processing';
  }
  if (error.includes('format') || error.includes('Unsupported')) {
    return 'Use JPG or PNG format for best OCR results';
  }
  if (error.includes('corrupted') || error.includes('Invalid')) {
    return 'Image file appears corrupted. Try re-saving or using a different image';
  }
  if (error.includes('timeout')) {
    return 'Image took too long to load. Try a smaller file or check your connection';
  }

  return error; // Return original error if no mapping found
};
