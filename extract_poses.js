const sharp = require('sharp');
const fs = require('fs');

async function processSheet(inputPath, prefix) {
  const image = sharp(inputPath);
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const channels = info.channels;

  // Find horizontal projection of non-white pixels
  const colNonWhite = new Array(w).fill(0);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const idx = (y * w + x) * channels;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      if (r < 235 || g < 235 || b < 235) {
        colNonWhite[x]++;
      }
    }
  }

  // Find distinct non-white regions
  const regions = [];
  let inRegion = false;
  let startX = 0;
  for (let x = 0; x < w; x++) {
    if (colNonWhite[x] > 15) {
      if (!inRegion) {
        inRegion = true;
        startX = x;
      }
    } else {
      if (inRegion) {
        inRegion = false;
        if (x - startX > 80) {
          regions.push({ startX, endX: x });
        }
      }
    }
  }
  if (inRegion && w - startX > 80) {
    regions.push({ startX, endX: w });
  }

  console.log(prefix, 'detected regions:', regions);

  const poseNames = ['left', 'down', 'right'];
  for (let i = 0; i < Math.min(3, regions.length); i++) {
    const reg = regions[i];
    // Find vertical bounds within this X region
    let minY = h, maxY = 0;
    for (let y = 0; y < h; y++) {
      for (let x = reg.startX; x < reg.endX; x++) {
        const idx = (y * w + x) * channels;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        if (r < 235 || g < 235 || b < 235) {
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    const pad = 12;
    const cropX = Math.max(0, reg.startX - pad);
    const cropW = Math.min(w - cropX, (reg.endX - reg.startX) + pad * 2);
    const cropY = Math.max(0, minY - pad);
    const cropH = Math.min(h - cropY, (maxY - minY) + pad * 2);

    console.log(prefix, poseNames[i], 'crop bounds:', { cropX, cropY, cropW, cropH });

    // Extract cropped image
    const croppedBuffer = await sharp(inputPath)
      .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const cW = croppedBuffer.info.width;
    const cH = croppedBuffer.info.height;
    const cChannels = croppedBuffer.info.channels;
    const cData = croppedBuffer.data;

    // Create RGBA buffer with transparent background
    const rgba = Buffer.alloc(cW * cH * 4);
    for (let p = 0; p < cW * cH; p++) {
      const srcIdx = p * cChannels;
      const destIdx = p * 4;
      const r = cData[srcIdx];
      const g = cData[srcIdx + 1];
      const b = cData[srcIdx + 2];

      rgba[destIdx] = r;
      rgba[destIdx + 1] = g;
      rgba[destIdx + 2] = b;
      if (r > 230 && g > 230 && b > 230) {
        rgba[destIdx + 3] = 0; // Transparent
      } else {
        rgba[destIdx + 3] = 255;
      }
    }

    // Pad into clean square canvas
    const maxDim = Math.max(cW, cH) + 16;
    const filename = prefix + '_' + poseNames[i] + '.png';
    
    await sharp(rgba, { raw: { width: cW, height: cH, channels: 4 } })
      .extend({
        top: Math.floor((maxDim - cH) / 2),
        bottom: Math.ceil((maxDim - cH) / 2),
        left: Math.floor((maxDim - cW) / 2),
        right: Math.ceil((maxDim - cW) / 2),
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(filename);

    fs.copyFileSync(filename, 'public/' + filename);
    console.log('Saved:', filename);
  }
}

async function run() {
  const brainPath = 'C:/Users/pablo/.gemini/antigravity-ide/brain/7dfc4587-88cd-487b-a387-29fb1c332841/';
  await processSheet(brainPath + 'human_boarder_sprites_1786756747661.jpg', 'human_boarder');
  await processSheet(brainPath + 'banana_boarder_sprites_1786756717021.jpg', 'banana_boarder');
  console.log('All 6 standalone sprite PNGs generated successfully!');
}

run();
