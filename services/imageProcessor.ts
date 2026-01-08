import { StickerSegment } from '../types';

export interface Rect {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Loads an image from a File object.
 */
export const loadImage = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Checks if a pixel is effectively "white" or transparent.
 */
const isBackground = (r: number, g: number, b: number, a: number): boolean => {
  if (a < 20) return true; // Transparent
  // High brightness is considered background (white paper)
  return r > 240 && g > 240 && b > 240;
};

/**
 * Merges bounding boxes that are spatially close to each other.
 */
const mergeRects = (rects: Rect[], distanceThreshold: number): Rect[] => {
  let merged = [...rects];
  let changed = true;

  while (changed) {
    changed = false;
    const newMerged: Rect[] = [];
    const visited = new Set<number>();

    for (let i = 0; i < merged.length; i++) {
      if (visited.has(i)) continue;

      let current = { ...merged[i] };
      visited.add(i);

      for (let j = i + 1; j < merged.length; j++) {
        if (visited.has(j)) continue;

        const other = merged[j];

        const xDist = Math.max(0, current.minX - other.maxX, other.minX - current.maxX);
        const yDist = Math.max(0, current.minY - other.maxY, other.minY - current.maxY);

        if (xDist < distanceThreshold && yDist < distanceThreshold) {
          current.minX = Math.min(current.minX, other.minX);
          current.minY = Math.min(current.minY, other.minY);
          current.maxX = Math.max(current.maxX, other.maxX);
          current.maxY = Math.max(current.maxY, other.maxY);
          visited.add(j);
          changed = true;
        }
      }
      newMerged.push(current);
    }
    merged = newMerged;
  }
  return merged;
};

/**
 * Extracts a specific region from an image/canvas, removes background, and adds a white stroke.
 */
export const extractStickerFromRect = (
  source: HTMLImageElement | HTMLCanvasElement,
  rect: Rect,
  defaultName: string = 'sticker'
): StickerSegment | null => {
  const padding = 2;
  const strokeWidth = 6; // Width of the white border

  const width = source.width;
  const height = source.height;

  // 1. Calculate dimensions for the raw cutout
  const finalX = Math.max(0, rect.minX - padding);
  const finalY = Math.max(0, rect.minY - padding);
  const finalW = Math.min(width - finalX, (rect.maxX - rect.minX) + padding * 2);
  const finalH = Math.min(height - finalY, (rect.maxY - rect.minY) + padding * 2);

  if (finalW <= 0 || finalH <= 0) return null;

  // 2. Create the raw cutout with background removed
  const segCanvas = document.createElement('canvas');
  segCanvas.width = finalW;
  segCanvas.height = finalH;
  const segCtx = segCanvas.getContext('2d');
  if (!segCtx) return null;

  segCtx.drawImage(
    source,
    finalX, finalY, finalW, finalH,
    0, 0, finalW, finalH
  );

  const segImageData = segCtx.getImageData(0, 0, finalW, finalH);
  const segPixels = segImageData.data;

  // Use flood-fill to find ONLY exterior background
  const isExterior = new Uint8Array(finalW * finalH);
  const stack: [number, number][] = [];

  // Push all edge pixels into the stack if they are background
  for (let x = 0; x < finalW; x++) {
    stack.push([x, 0], [x, finalH - 1]);
  }
  for (let y = 1; y < finalH - 1; y++) {
    stack.push([0, y], [finalW - 1, y]);
  }

  while (stack.length > 0) {
    const [cx, cy] = stack.pop()!;
    const idx = (cy * finalW + cx) * 4;
    const visitIdx = cy * finalW + cx;

    if (!isExterior[visitIdx] && isBackground(segPixels[idx], segPixels[idx + 1], segPixels[idx + 2], segPixels[idx + 3])) {
      isExterior[visitIdx] = 1;

      // Check 4-neighbors
      if (cx > 0) stack.push([cx - 1, cy]);
      if (cx < finalW - 1) stack.push([cx + 1, cy]);
      if (cy > 0) stack.push([cx, cy - 1]);
      if (cy < finalH - 1) stack.push([cx, cy + 1]);
    }
  }

  // Now clear only pixels that are both exterior AND background
  for (let i = 0; i < finalW * finalH; i++) {
    if (isExterior[i]) {
      segPixels[i * 4 + 3] = 0;
    }
  }
  segCtx.putImageData(segImageData, 0, 0);

  // 3. Create a silhouette for the stroke
  const silhouetteCanvas = document.createElement('canvas');
  silhouetteCanvas.width = finalW;
  silhouetteCanvas.height = finalH;
  const sCtx = silhouetteCanvas.getContext('2d');
  if (!sCtx) return null;

  sCtx.drawImage(segCanvas, 0, 0);
  sCtx.globalCompositeOperation = 'source-in';
  sCtx.fillStyle = '#FFFFFF';
  sCtx.fillRect(0, 0, finalW, finalH);

  // 4. Create Final Canvas with extra space for the stroke
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = finalW + (strokeWidth * 2);
  finalCanvas.height = finalH + (strokeWidth * 2);
  const fCtx = finalCanvas.getContext('2d');
  if (!fCtx) return null;

  // Enable smoothing for better stroke edges
  fCtx.imageSmoothingEnabled = true;
  fCtx.imageSmoothingQuality = 'high';

  // Draw the silhouette multiple times in a circle to create the stroke
  const steps = 24;
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const ox = strokeWidth + Math.cos(angle) * strokeWidth;
    const oy = strokeWidth + Math.sin(angle) * strokeWidth;
    fCtx.drawImage(silhouetteCanvas, ox, oy);
  }

  // Fill the center of the stroke to ensure no gaps between stroke and image
  // (This also helps fill in small internal holes that were removed by background keying)
  fCtx.drawImage(silhouetteCanvas, strokeWidth, strokeWidth);

  // 5. Draw the original colored image on top
  fCtx.globalCompositeOperation = 'source-over';
  fCtx.drawImage(segCanvas, strokeWidth, strokeWidth);

  const generateId = () => {
    try {
      return crypto.randomUUID();
    } catch (e) {
      return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }
  };

  return {
    id: generateId(),
    dataUrl: finalCanvas.toDataURL('image/png'),
    originalX: finalX,
    originalY: finalY,
    width: finalCanvas.width,
    height: finalCanvas.height,
    name: defaultName,
    isNaming: false
  };
};

/**
 * Main function to process the sticker sheet.
 */
export const processStickerSheet = async (
  image: HTMLImageElement,
  onProgress: (msg: string) => void
): Promise<StickerSegment[]> => {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) throw new Error("Could not get canvas context");

  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { width, height, data } = imageData;

  onProgress("Scanning image for content...");

  const visited = new Uint8Array(width * height);
  const rawRects: Rect[] = [];
  const getIdx = (x: number, y: number) => (y * width + x) * 4;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const visitIdx = y * width + x;

      if (visited[visitIdx]) continue;

      const idx = getIdx(x, y);
      if (!isBackground(data[idx], data[idx + 1], data[idx + 2], data[idx + 3])) {
        let minX = x, maxX = x, minY = y, maxY = y;
        let count = 0;

        const stack = [[x, y]];
        visited[visitIdx] = 1;

        while (stack.length > 0) {
          const [cx, cy] = stack.pop()!;
          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;
          count++;

          const neighbors = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];

          for (const [nx, ny] of neighbors) {
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nVisitIdx = ny * width + nx;
              if (visited[nVisitIdx] === 0) {
                const nIdx = getIdx(nx, ny);
                if (!isBackground(data[nIdx], data[nIdx + 1], data[nIdx + 2], data[nIdx + 3])) {
                  visited[nVisitIdx] = 1;
                  stack.push([nx, ny]);
                }
              }
            }
          }
        }

        const w = maxX - minX;
        const h = maxY - minY;
        if (count > 50 && w > 5 && h > 5) {
          rawRects.push({ minX, maxX, minY, maxY });
        }
      }
    }
  }

  onProgress(`Detected ${rawRects.length} components. Grouping...`);

  // Reduced threshold from 50 to 15 to prevent merging distinct stickers
  const mergedRects = mergeRects(rawRects, 15);

  onProgress(`Identified ${mergedRects.length} stickers. Extracting...`);

  const finalSegments: StickerSegment[] = [];

  for (let i = 0; i < mergedRects.length; i++) {
    const rect = mergedRects[i];
    const segment = extractStickerFromRect(canvas, rect, `sticker_${i + 1}`);
    if (segment) {
      finalSegments.push(segment);
    }
  }

  return finalSegments;
};