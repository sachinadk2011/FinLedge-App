"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function createIconAssets(iconPath, logLine) {
  const ICON_PATH = iconPath;
  function crc32(buffer) {
    let crc = 0xffffffff;
    for (let i = 0; i < buffer.length; i++) {
      crc ^= buffer[i];
      for (let j = 0; j < 8; j++) {
        const mask = -(crc & 1);
        crc = (crc >>> 1) ^ (0xedb88320 & mask);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function pngChunk(type, data) {
    const typeBuf = Buffer.from(type, "ascii");
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length, 0);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
  }

  function createPlaceholderIconPng(filePath) {
    const width = 256;
    const height = 256;
    const rowSize = 1 + width * 4;
    const raw = Buffer.alloc(rowSize * height);

    const cx = width / 2;
    const cy = height / 2;
    const radius = width / 2;
    const corner = 110; // ~43% of size — near-circle but corners still visible
    const minCorner = corner;
    const maxCorner = width - 1 - corner;
    for (let y = 0; y < height; y++) {
      raw[y * rowSize] = 0;
      for (let x = 0; x < width; x++) {
        const i = y * rowSize + 1 + x * 4;
        let inside = true;
        if (x < minCorner && y < minCorner) {
          // top-left corner circle
          const dx = x - minCorner;
          const dy = y - minCorner;
          inside = dx * dx + dy * dy <= corner * corner;
        } else if (x > maxCorner && y < minCorner) {
          // top-right
          const dx = x - maxCorner;
          const dy = y - minCorner;
          inside = dx * dx + dy * dy <= corner * corner;
        } else if (x < minCorner && y > maxCorner) {
          // bottom-left
          const dx = x - minCorner;
          const dy = y - maxCorner;
          inside = dx * dx + dy * dy <= corner * corner;
        } else if (x > maxCorner && y > maxCorner) {
          // bottom-right
          const dx = x - maxCorner;
          const dy = y - maxCorner;
          inside = dx * dx + dy * dy <= corner * corner;
        }
        if (!inside) {
          raw[i + 3] = 0;
          continue;
        }
        const t = (x + y) / (width + height);
        raw[i] = Math.round(11 + 17 * t);
        raw[i + 1] = Math.round(122 + 34 * t);
        raw[i + 2] = Math.round(118 + 30 * t);
        raw[i + 3] = 255;
      }
    }

    function fillRect(x0, y0, w, h) {
      const x1 = Math.min(width, x0 + w);
      const y1 = Math.min(height, y0 + h);
      for (let y = Math.max(0, y0); y < y1; y++) {
        for (let x = Math.max(0, x0); x < x1; x++) {
          const i = y * rowSize + 1 + x * 4;
          raw[i] = 255;
          raw[i + 1] = 255;
          raw[i + 2] = 255;
          raw[i + 3] = 255;
        }
      }
    }

    // Block "FL" mark (white) on the teal gradient, matching the branded icons.
    // Centered geometry: bbox x 53..203, y 56..200 (both center at 128).
    const fx = 53;
    const fy = 56;
    // F vertical + top bar + middle bar
    fillRect(fx, fy, 28, 144);
    fillRect(fx, fy, 90, 24);
    fillRect(fx, fy + 60, 70, 22);
    // L vertical + bottom bar
    fillRect(fx + 112, fy, 28, 144);
    fillRect(fx + 112, fy + 118, 38, 22);

    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;

    const idat = zlib.deflateSync(raw, { level: 9 });
    const png = Buffer.concat([
      signature,
      pngChunk("IHDR", ihdr),
      pngChunk("IDAT", idat),
      pngChunk("IEND", Buffer.alloc(0)),
    ]);

    fs.writeFileSync(filePath, png);
  }

  function ensureIconExists() {
    if (fs.existsSync(ICON_PATH)) {
      return;
    }

    try {
      fs.mkdirSync(path.dirname(ICON_PATH), { recursive: true });
      createPlaceholderIconPng(ICON_PATH);
    } catch (err) {
      logLine("[main] Could not create placeholder icon", String(err));
    }
  }
  return { ensureIconExists };
}

module.exports = { createIconAssets };
