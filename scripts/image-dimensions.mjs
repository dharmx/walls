import fs from 'node:fs';

export function getImageDimensions(filePath) {
  let fd;
  try {
    const buffer = Buffer.alloc(100);
    fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 100, 0);
    fs.closeSync(fd);
    fd = null;

    // 1. PNG
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height };
    }

    // 2. GIF
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) { // 'GIF'
      const width = buffer.readUInt16LE(6);
      const height = buffer.readUInt16LE(8);
      return { width, height };
    }

    // 3. WEBP
    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
      // VP8X
      if (buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38 && buffer[15] === 0x58) {
        const width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16));
        const height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16));
        return { width, height };
      }
      // VP8L
      if (buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38 && buffer[15] === 0x4C) {
        const b0 = buffer[21];
        const b1 = buffer[22];
        const b2 = buffer[23];
        const b3 = buffer[24];
        const width = 1 + (((b1 & 0x3F) << 8) | b0);
        const height = 1 + (((b3 & 0xF) << 10) | (b2 << 2) | ((b1 & 0xC0) >> 6));
        return { width, height };
      }
      // VP8
      if (buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38 && buffer[15] === 0x20) {
        const width = buffer.readUInt16LE(26) & 0x3fff;
        const height = buffer.readUInt16LE(28) & 0x3fff;
        return { width, height };
      }
    }

    // 4. JPEG
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
      // Need to read larger buffer for JPEG markers
      const fileSize = fs.statSync(filePath).size;
      const readSize = Math.min(fileSize, 65536); // read first 64KB
      const jpegBuf = Buffer.alloc(readSize);
      fd = fs.openSync(filePath, 'r');
      fs.readSync(fd, jpegBuf, 0, readSize, 0);
      fs.closeSync(fd);
      fd = null;

      let offset = 2;
      while (offset < jpegBuf.length - 8) {
        if (jpegBuf[offset] !== 0xFF) {
          offset++;
          continue;
        }
        const marker = jpegBuf[offset + 1];
        // SOF0 (0xC0), SOF1 (0xC1), SOF2 (0xC2), SOF3 (0xC3), SOF5, SOF6, SOF7, SOF9, SOF10, SOF11, SOF13, SOF14, SOF15
        if ((marker >= 0xC0 && marker <= 0xC3) || (marker >= 0xC5 && marker <= 0xC7) || 
            (marker >= 0xC9 && marker <= 0xCB) || (marker >= 0xCD && marker <= 0xCF)) {
          const height = jpegBuf.readUInt16BE(offset + 5);
          const width = jpegBuf.readUInt16BE(offset + 7);
          return { width, height };
        }
        const blockLength = jpegBuf.readUInt16BE(offset + 2);
        offset += 2 + blockLength;
      }
    }
  } catch (err) {
    // Return null if dimension parsing fails
  } finally {
    if (fd !== null && fd !== undefined) {
      try { fs.closeSync(fd); } catch (e) {}
    }
  }
  return null;
}
