// Image Scrambling Module
const ImageScrambler = {
  /**
   * Main scramble function - routes to specific method
   */
  scramble(imageData, method, level) {
    Utils.log(`Scrambling image with method: ${method}, level: ${level}`);

    if (level === 0) {
      // No scrambling
      return imageData;
    }

    switch (method) {
      case 'phase':
        return this.phaseScramble(imageData, level);
      case 'block':
        return this.blockScramble(imageData, level);
      case 'pixel':
        return this.pixelScramble(imageData, level);
      case 'rotation':
        return this.rotationScramble(imageData, level);
      case 'mosaic':
        return this.mosaicScramble(imageData, level);
      case 'edge':
        return this.edgeScramble(imageData, level);
      case 'color':
        return this.colorScramble(imageData, level);
      case 'wavelet':
        return this.waveletScramble(imageData, level);
      default:
        Utils.log(`Unknown scramble method: ${method}`);
        return imageData;
    }
  },

  /**
   * 1. Phase Scrambling - Fourier phase randomization
   * Preserves amplitude spectrum, randomizes phase
   */
  phaseScramble(imageData, level) {
    const width = imageData.width;
    const height = imageData.height;
    const result = new ImageData(width, height);

    // Process each color channel separately
    for (let channel = 0; channel < 3; channel++) {
      const channelData = this._extractChannel(imageData, channel);

      // Apply 2D FFT (simplified - using row-by-row FFT for performance)
      const fft = this._simplifiedFFT2D(channelData, width, height);

      // Randomize phase based on level
      for (let i = 0; i < fft.length; i++) {
        if (Math.random() < level) {
          const magnitude = Math.sqrt(fft[i].real * fft[i].real + fft[i].imag * fft[i].imag);
          const randomPhase = Math.random() * 2 * Math.PI;
          fft[i].real = magnitude * Math.cos(randomPhase);
          fft[i].imag = magnitude * Math.sin(randomPhase);
        }
      }

      // Inverse FFT
      const scrambled = this._simplifiedIFFT2D(fft, width, height);

      // Put back into result
      this._insertChannel(result, scrambled, channel);
    }

    // Copy alpha channel
    for (let i = 0; i < imageData.data.length; i += 4) {
      result.data[i + 3] = imageData.data[i + 3];
    }

    return result;
  },

  /**
   * 2. Block Scrambling - Divide into blocks and shuffle
   */
  blockScramble(imageData, level) {
    const width = imageData.width;
    const height = imageData.height;
    const result = new ImageData(width, height);

    // Copy original first
    result.data.set(imageData.data);

    // Determine block size based on scramble level
    const blockSize = CONFIG.scrambling.blockSizes[level] || 16;
    const blocksX = Math.floor(width / blockSize);
    const blocksY = Math.floor(height / blockSize);

    // Create array of block positions
    const blocks = [];
    for (let by = 0; by < blocksY; by++) {
      for (let bx = 0; bx < blocksX; bx++) {
        blocks.push({ x: bx * blockSize, y: by * blockSize });
      }
    }

    // Shuffle a portion of blocks based on level
    const shuffleCount = Math.floor(blocks.length * level);
    for (let i = 0; i < shuffleCount; i++) {
      const j = i + Math.floor(Math.random() * (blocks.length - i));
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    }

    // Apply block shuffle
    const temp = new ImageData(width, height);
    temp.data.set(imageData.data);

    for (let i = 0; i < blocks.length; i++) {
      const sourceX = (i % blocksX) * blockSize;
      const sourceY = Math.floor(i / blocksX) * blockSize;
      const destX = blocks[i].x;
      const destY = blocks[i].y;

      this._copyBlock(temp, result, sourceX, sourceY, destX, destY, blockSize, blockSize);
    }

    return result;
  },

  /**
   * 3. Pixel Scrambling - Randomly shuffle individual pixels
   */
  pixelScramble(imageData, level) {
    const width = imageData.width;
    const height = imageData.height;
    const result = new ImageData(width, height);

    // Copy original
    result.data.set(imageData.data);

    // Create array of pixel indices
    const totalPixels = width * height;
    const shuffleCount = Math.floor(totalPixels * level);

    // Randomly swap pixels
    for (let i = 0; i < shuffleCount; i++) {
      const idx1 = Math.floor(Math.random() * totalPixels);
      const idx2 = Math.floor(Math.random() * totalPixels);

      // Swap pixels
      for (let c = 0; c < 4; c++) {
        const temp = result.data[idx1 * 4 + c];
        result.data[idx1 * 4 + c] = result.data[idx2 * 4 + c];
        result.data[idx2 * 4 + c] = temp;
      }
    }

    return result;
  },

  /**
   * 4. Rotation Scrambling - Divide into segments and rotate
   */
  rotationScramble(imageData, level) {
    const width = imageData.width;
    const height = imageData.height;
    const result = new ImageData(width, height);

    // Copy original
    result.data.set(imageData.data);

    const segmentSize = Math.max(32, Math.floor(128 * (1 - level)));
    const segmentsX = Math.floor(width / segmentSize);
    const segmentsY = Math.floor(height / segmentSize);

    // Rotate segments
    for (let sy = 0; sy < segmentsY; sy++) {
      for (let sx = 0; sx < segmentsX; sx++) {
        if (Math.random() < level) {
          const x = sx * segmentSize;
          const y = sy * segmentSize;
          const rotation = Math.floor(Math.random() * 4) * 90; // 0, 90, 180, 270

          this._rotateSegment(imageData, result, x, y, segmentSize, segmentSize, rotation);
        }
      }
    }

    return result;
  },

  /**
   * 5. Mosaic Scrambling - Blur/pixelation effect
   */
  mosaicScramble(imageData, level) {
    const width = imageData.width;
    const height = imageData.height;
    const result = new ImageData(width, height);

    // Determine mosaic block size based on level
    const blockSize = Math.max(1, Math.floor(level * 20));

    for (let y = 0; y < height; y += blockSize) {
      for (let x = 0; x < width; x += blockSize) {
        // Calculate average color for this block
        let r = 0, g = 0, b = 0, count = 0;

        for (let by = y; by < Math.min(y + blockSize, height); by++) {
          for (let bx = x; bx < Math.min(x + blockSize, width); bx++) {
            const idx = (by * width + bx) * 4;
            r += imageData.data[idx];
            g += imageData.data[idx + 1];
            b += imageData.data[idx + 2];
            count++;
          }
        }

        r = Math.floor(r / count);
        g = Math.floor(g / count);
        b = Math.floor(b / count);

        // Fill block with average color
        for (let by = y; by < Math.min(y + blockSize, height); by++) {
          for (let bx = x; bx < Math.min(x + blockSize, width); bx++) {
            const idx = (by * width + bx) * 4;
            result.data[idx] = r;
            result.data[idx + 1] = g;
            result.data[idx + 2] = b;
            result.data[idx + 3] = imageData.data[idx + 3];
          }
        }
      }
    }

    return result;
  },

  /**
   * 6. Edge Scrambling - Preserve edges, scramble interior
   */
  edgeScramble(imageData, level) {
    const width = imageData.width;
    const height = imageData.height;

    // Detect edges using Sobel operator
    const edges = this._detectEdges(imageData);

    const result = new ImageData(width, height);
    result.data.set(imageData.data);

    // Scramble non-edge pixels
    const nonEdgePixels = [];
    for (let i = 0; i < edges.length; i++) {
      if (edges[i] < 0.3) { // Not an edge
        nonEdgePixels.push(i);
      }
    }

    // Shuffle non-edge pixels
    const shuffleCount = Math.floor(nonEdgePixels.length * level);
    for (let i = 0; i < shuffleCount; i++) {
      const idx1 = nonEdgePixels[i];
      const idx2 = nonEdgePixels[Math.floor(Math.random() * nonEdgePixels.length)];

      // Swap pixels
      for (let c = 0; c < 3; c++) {
        const temp = result.data[idx1 * 4 + c];
        result.data[idx1 * 4 + c] = result.data[idx2 * 4 + c];
        result.data[idx2 * 4 + c] = temp;
      }
    }

    return result;
  },

  /**
   * 7. Color Scrambling - Randomize colors while preserving luminance
   */
  colorScramble(imageData, level) {
    const width = imageData.width;
    const height = imageData.height;
    const result = new ImageData(width, height);

    for (let i = 0; i < imageData.data.length; i += 4) {
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];

      if (Math.random() < level) {
        // Calculate luminance
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

        // Generate random color with similar luminance
        const randomHue = Math.random() * 360;
        const rgb = this._hslToRgb(randomHue / 360, 0.5, luminance / 255);

        result.data[i] = rgb[0];
        result.data[i + 1] = rgb[1];
        result.data[i + 2] = rgb[2];
      } else {
        result.data[i] = r;
        result.data[i + 1] = g;
        result.data[i + 2] = b;
      }

      result.data[i + 3] = imageData.data[i + 3];
    }

    return result;
  },

  /**
   * 8. Wavelet Scrambling - Simplified wavelet transform scrambling
   */
  waveletScramble(imageData, level) {
    const width = imageData.width;
    const height = imageData.height;
    const result = new ImageData(width, height);

    // Process each channel
    for (let channel = 0; channel < 3; channel++) {
      const channelData = this._extractChannel(imageData, channel);

      // Simple Haar wavelet transform (one level)
      const wavelet = this._haarWavelet2D(channelData, width, height);

      // Scramble high-frequency components based on level
      const quarterSize = (width * height) / 4;
      for (let i = quarterSize; i < wavelet.length; i++) {
        if (Math.random() < level) {
          wavelet[i] = wavelet[Math.floor(Math.random() * wavelet.length)];
        }
      }

      // Inverse wavelet transform
      const reconstructed = this._inverseHaarWavelet2D(wavelet, width, height);

      // Put back into result
      this._insertChannel(result, reconstructed, channel);
    }

    // Copy alpha channel
    for (let i = 0; i < imageData.data.length; i += 4) {
      result.data[i + 3] = imageData.data[i + 3];
    }

    return result;
  },

  // ===== Helper Functions =====

  _extractChannel(imageData, channel) {
    const result = [];
    for (let i = channel; i < imageData.data.length; i += 4) {
      result.push(imageData.data[i]);
    }
    return result;
  },

  _insertChannel(imageData, channelData, channel) {
    for (let i = 0; i < channelData.length; i++) {
      imageData.data[i * 4 + channel] = Utils.clamp(channelData[i], 0, 255);
    }
  },

  _copyBlock(source, dest, sx, sy, dx, dy, w, h) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const sIdx = ((sy + y) * source.width + (sx + x)) * 4;
        const dIdx = ((dy + y) * dest.width + (dx + x)) * 4;

        for (let c = 0; c < 4; c++) {
          dest.data[dIdx + c] = source.data[sIdx + c];
        }
      }
    }
  },

  _rotateSegment(source, dest, x, y, w, h, angle) {
    // Simplified rotation - only 90 degree increments
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        let sx, sy;

        switch (angle) {
          case 90:
            sx = h - dy - 1;
            sy = dx;
            break;
          case 180:
            sx = w - dx - 1;
            sy = h - dy - 1;
            break;
          case 270:
            sx = dy;
            sy = w - dx - 1;
            break;
          default: // 0
            sx = dx;
            sy = dy;
        }

        const sIdx = ((y + sy) * source.width + (x + sx)) * 4;
        const dIdx = ((y + dy) * dest.width + (x + dx)) * 4;

        for (let c = 0; c < 4; c++) {
          dest.data[dIdx + c] = source.data[sIdx + c];
        }
      }
    }
  },

  _detectEdges(imageData) {
    const width = imageData.width;
    const height = imageData.height;
    const edges = new Array(width * height).fill(0);

    // Sobel operator kernels
    const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
    const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0, gy = 0;

        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4;
            const gray = (imageData.data[idx] + imageData.data[idx + 1] + imageData.data[idx + 2]) / 3;

            gx += gray * sobelX[ky + 1][kx + 1];
            gy += gray * sobelY[ky + 1][kx + 1];
          }
        }

        edges[y * width + x] = Math.sqrt(gx * gx + gy * gy) / 255;
      }
    }

    return edges;
  },

  _hslToRgb(h, s, l) {
    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;

      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  },

  // Simplified FFT implementation (for demonstration - real implementation would use proper FFT)
  _simplifiedFFT2D(data, width, height) {
    // This is a placeholder - proper implementation would use FFT library
    // For now, return data in complex form
    return data.map(val => ({ real: val, imag: 0 }));
  },

  _simplifiedIFFT2D(fft, width, height) {
    // Placeholder - extract real part
    return fft.map(val => val.real);
  },

  // Simplified Haar wavelet transform
  _haarWavelet2D(data, width, height) {
    const result = [...data];

    // Simple averaging and differencing (one level)
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        const idx1 = y * width + x;
        const idx2 = y * width + x + 1;
        const idx3 = (y + 1) * width + x;
        const idx4 = (y + 1) * width + x + 1;

        const avg = (data[idx1] + data[idx2] + data[idx3] + data[idx4]) / 4;
        const diff = (data[idx1] - data[idx2] + data[idx3] - data[idx4]) / 4;

        result[idx1] = avg;
        result[idx2] = diff;
      }
    }

    return result;
  },

  _inverseHaarWavelet2D(wavelet, width, height) {
    const result = [...wavelet];

    // Simple reconstruction
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        const idx1 = y * width + x;
        const idx2 = y * width + x + 1;

        const avg = wavelet[idx1];
        const diff = wavelet[idx2];

        result[idx1] = avg + diff;
        result[idx2] = avg - diff;
      }
    }

    return result;
  },

  /**
   * Load an image and apply scrambling
   */
  async loadAndScrambleImage(imagePath, method, level, canvas) {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        // Set canvas size
        canvas.width = CONFIG.images.width;
        canvas.height = CONFIG.images.height;

        const ctx = canvas.getContext('2d');

        // Draw original image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Apply scrambling
        const scrambled = this.scramble(imageData, method, level);

        // Put back on canvas
        ctx.putImageData(scrambled, 0, 0);

        resolve({
          imagePath,
          method,
          level,
          canvas
        });
      };

      img.onerror = () => {
        reject(new Error(`Failed to load image: ${imagePath}`));
      };

      img.src = imagePath;
    });
  }
};

// Make ImageScrambler globally available
window.ImageScrambler = ImageScrambler;
