import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPng(width, height, drawFn) {
  // 8-byte PNG header
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // Raw image data with scanline filter byte (0 = None)
  const rawBytes = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;

  for (let y = 0; y < height; y++) {
    rawBytes[offset++] = 0; // Filter byte: 0
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawFn(x, y, width, height);
      rawBytes[offset++] = r;
      rawBytes[offset++] = g;
      rawBytes[offset++] = b;
      rawBytes[offset++] = a;
    }
  }

  const compressed = zlib.deflateSync(rawBytes);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  const crcTarget = Buffer.alloc(4 + len);
  chunk.copy(crcTarget, 0, 4, 8 + len);
  const crcVal = crc32(crcTarget);
  chunk.writeUInt32BE(crcVal, 8 + len);

  return chunk;
}

// Background: Dark Slate (#0B0F17) with rounded squircle and Amber (#F59E0B) icon
function drawAppIcon(x, y, width, height, isMaskable = false) {
  const nx = x / width;
  const ny = y / height;
  const cx = 0.5;
  const cy = 0.5;
  const dx = nx - cx;
  const dy = ny - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Background
  let r = 11, g = 15, b = 23, a = 255;

  // Maskable icons fill entire canvas with safe zone margin
  if (!isMaskable) {
    // Corner rounding for regular icons
    const cornerR = 0.22;
    const clampedX = Math.abs(dx) - (0.5 - cornerR);
    const clampedY = Math.abs(dy) - (0.5 - cornerR);
    if (clampedX > 0 && clampedY > 0) {
      const cornerDist = Math.sqrt(clampedX * clampedX + clampedY * clampedY);
      if (cornerDist > cornerR) {
        return [0, 0, 0, 0]; // Transparent outer corner
      }
    }
  }

  // Draw 3x3 Grid pattern in center
  const scale = isMaskable ? 0.35 : 0.42;
  const gx = (nx - 0.5) / scale;
  const gy = (ny - 0.5) / scale;

  if (Math.abs(gx) < 0.5 && Math.abs(gy) < 0.5) {
    // Inside grid box area
    const cellX = Math.floor((gx + 0.5) * 3);
    const cellY = Math.floor((gy + 0.5) * 3);
    const innerX = ((gx + 0.5) * 3) % 1;
    const innerY = ((gy + 0.5) * 3) % 1;

    // Grid lines
    if (innerX < 0.08 || innerY < 0.08) {
      r = 30; g = 41; b = 59;
    } else {
      // Cell contents - Accent 3x3 pattern highlighting "9"
      if ((cellX === 1 && cellY === 1) || (cellX === 2 && cellY === 0) || (cellX === 2 && cellY === 1) || (cellX === 2 && cellY === 2)) {
        r = 245; g = 158; b = 11; // Amber #F59E0B
      } else if (cellX === 0 && cellY === 0) {
        r = 251; g = 191; b = 36; // Amber 400
      } else {
        r = 19; g = 27; b = 46;
      }
    }
  }

  // Glowing center ring
  if (dist > 0.42 && dist < 0.45 && !isMaskable) {
    r = Math.min(255, r + 80);
    g = Math.min(255, g + 60);
    b = Math.min(255, b + 10);
  }

  return [r, g, b, a];
}

const publicDir = path.resolve(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Generate icons
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPng(192, 192, (x, y, w, h) => drawAppIcon(x, y, w, h, false)));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPng(512, 512, (x, y, w, h) => drawAppIcon(x, y, w, h, false)));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPng(512, 512, (x, y, w, h) => drawAppIcon(x, y, w, h, true)));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPng(180, 180, (x, y, w, h) => drawAppIcon(x, y, w, h, false)));

console.log('Successfully generated PWA and Android icons in public/');
