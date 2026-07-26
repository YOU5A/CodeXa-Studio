const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ── Constants ──
const NCM_MAGIC = Buffer.from([0x43, 0x54, 0x45, 0x4E, 0x46, 0x44, 0x41, 0x4D]);

const AES_CORE_KEY = Buffer.from([
  0x68, 0x7A, 0x48, 0x52, 0x41, 0x6D, 0x73, 0x6F,
  0x35, 0x6B, 0x49, 0x6E, 0x62, 0x61, 0x78, 0x57
]);

const AES_MODIFY_KEY = Buffer.from([
  0x23, 0x31, 0x34, 0x6C, 0x6A, 0x6B, 0x5F, 0x21,
  0x5C, 0x5D, 0x26, 0x30, 0x55, 0x3C, 0x27, 0x28
]);

const NET_MARKER = Buffer.from("neteasecloudmusic");
const META_PREFIX = "163 key(Don't modify):";
const MUSIC_PREFIX = "music:";

// ── Crypto helpers ──

function aesEcbDecrypt(key, data) {
  const decipher = crypto.createDecipheriv("aes-128-ecb", key, null);
  decipher.setAutoPadding(false);
  let decrypted = decipher.update(data);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted;
}

function pkcs7Unpad(data) {
  if (data.length === 0) return data;
  const padLen = data[data.length - 1];
  if (padLen === 0 || padLen > 16 || padLen > data.length) return data;
  return data.subarray(0, data.length - padLen);
}

function buildKeyBox(key) {
  const box = Buffer.alloc(256);
  for (let i = 0; i < 256; i++) box[i] = i;
  const keyLen = key.length;
  let lastByte = 0, keyOffset = 0;
  for (let i = 0; i < 256; i++) {
    const c = (box[i] + lastByte + key[keyOffset]) & 0xff;
    keyOffset++;
    if (keyOffset >= keyLen) keyOffset = 0;
    [box[i], box[c]] = [box[c], box[i]];
    lastByte = c;
  }
  return box;
}

function xorBytes(data, value) {
  for (let i = 0; i < data.length; i++) data[i] ^= value;
  return data;
}

function bufferIndexOf(haystack, needle) {
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

// ── Key derivation ──

function deriveAesKey(keyData) {
  // Step 1: XOR with 0x64
  const xored = xorBytes(Buffer.from(keyData), 0x64);

  // Step 2: AES-128-ECB decrypt (truncate to 16-byte boundary)
  const alignedLen = Math.floor(xored.length / 16) * 16;
  let decrypted = aesEcbDecrypt(AES_CORE_KEY, xored.subarray(0, alignedLen));

  // Step 3: PKCS7 unpad
  decrypted = pkcs7Unpad(decrypted);

  // Step 4: Find marker + extract key after marker
  const markerPos = bufferIndexOf(decrypted, NET_MARKER);
  if (markerPos < 0) {
    throw new Error(
      `Cannot locate 'neteasecloudmusic' marker in decrypted key data. ` +
      `Key size: ${keyData.length} bytes. File may use an unsupported NCM variant.`
    );
  }

  // Key is all bytes AFTER the marker (matches yoki123/ncmdump)
  let start = markerPos + NET_MARKER.length;
  while (start < decrypted.length && decrypted[start] === 0) start++;

  if (start >= decrypted.length) {
    throw new Error(
      `No data after marker. Marker at offset ${markerPos}.`
    );
  }

  return decrypted.subarray(start);
}

// ── Metadata parsing ──

function parseMetadata(metaBytes, coverData) {
  if (!metaBytes || metaBytes.length === 0) {
    return makeEmptyMeta(coverData);
  }

  // Try old format: plain JSON (starts with '{')
  const rawStr = metaBytes.toString("utf-8").replace(/^\0+/, "");
  if (rawStr.startsWith("{")) {
    return parseMetaJson(rawStr, coverData);
  }

  // Try new format: XOR 0x63 → "163 key(Don't modify):" + base64(AES_ECB("music:" + JSON))
  try {
    const xored = xorBytes(Buffer.from(metaBytes), 0x63);
    const xoredStr = xored.toString("utf-8").replace(/\0+$/, "");

    if (xoredStr.startsWith(META_PREFIX)) {
      const b64 = xoredStr.substring(META_PREFIX.length).trim();
      const decoded = Buffer.from(b64, "base64");

      // Truncate to 16-byte boundary and decrypt
      const alignedLen = Math.floor(decoded.length / 16) * 16;
      let decrypted = aesEcbDecrypt(AES_MODIFY_KEY, decoded.subarray(0, alignedLen));
      decrypted = pkcs7Unpad(decrypted);

      const decryptedStr = decrypted.toString("utf-8");
      if (decryptedStr.startsWith(MUSIC_PREFIX)) {
        const json = decryptedStr.substring(MUSIC_PREFIX.length);
        return parseMetaJson(json, coverData);
      }
    }
  } catch (e) {
    // Fall through
  }

  return makeEmptyMeta(coverData);
}

function parseMetaJson(jsonStr, coverData) {
  try {
    const meta = JSON.parse(jsonStr);
    
    let artist = "";
    if (Array.isArray(meta.artist)) {
      artist = meta.artist
        .filter(item => Array.isArray(item) && item.length > 0)
        .map(item => String(item[0] || ""))
        .filter(Boolean)
        .join(", ");
    }

    return {
      musicId: meta.musicId || 0,
      title: meta.musicName || "",
      artist,
      album: meta.album || "",
      format: meta.format || "",
      bitrate: meta.bitrate || 0,
      duration: meta.duration || 0,
      hasCover: coverData && coverData.length > 0,
      coverBase64: coverData ? coverData.toString("base64") : null,
    };
  } catch (e) {
    return makeEmptyMeta(coverData);
  }
}

function makeEmptyMeta(coverData) {
  return {
    musicId: 0,
    title: "",
    artist: "",
    album: "",
    format: "",
    bitrate: 0,
    duration: 0,
    hasCover: coverData && coverData.length > 0,
    coverBase64: coverData ? coverData.toString("base64") : null,
  };
}

// ── RPC methods ──

async function listNcm(params) {
  const folder = params.folder || "";
  const recursive = params.recursive !== false;

  if (!folder || !fs.existsSync(folder)) {
    return { error: `Folder does not exist: ${folder}`, files: [] };
  }

  const files = [];
  const walkDir = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && recursive) {
        walkDir(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".ncm")) {
        files.push(fullPath);
      }
    }
  };

  walkDir(folder);
  files.sort((a, b) => path.basename(a).toLowerCase().localeCompare(path.basename(b).toLowerCase()));

  return { files, count: files.length };
}

async function getInfo(params) {
  const filepath = params.filepath || "";
  if (!filepath || !fs.existsSync(filepath)) {
    return { error: "File not found" };
  }

  try {
    const buf = fs.readFileSync(filepath);
    if (buf.length < 10) return { error: "File too small" };

    // Check NCM magic
    if (!buf.subarray(0, 8).equals(NCM_MAGIC)) {
      return { error: "Not a valid NCM file" };
    }

    // Read key length at offset 10 (skip 8 magic + 2 gap)
    const keyLength = buf.readUInt32LE(10);

    // Read metadata: starts at 14 + keyLength
    const metaStart = 14 + keyLength;
    if (metaStart + 4 > buf.length) {
      return parseMetadata(null, null);
    }

    const metaLength = buf.readUInt32LE(metaStart);
    const metaJsonStart = metaStart + 4;

    let metaBytes = null;
    if (metaLength > 0 && metaLength < 1024 * 1024 && metaJsonStart + metaLength <= buf.length) {
      metaBytes = buf.subarray(metaJsonStart, metaJsonStart + metaLength);
    }

    // Read cover image
    const coverStart = metaJsonStart + metaLength + 4 + 5; // skip CRC32(4) + Gap2(5)
    let coverData = null;
    if (coverStart + 4 <= buf.length) {
      const imageSize = buf.readUInt32LE(coverStart);
      if (imageSize > 0 && imageSize < 10 * 1024 * 1024 && coverStart + 4 + imageSize <= buf.length) {
        coverData = buf.subarray(coverStart + 4, coverStart + 4 + imageSize);
      }
    }

    return parseMetadata(metaBytes, coverData);
  } catch (e) {
    return { error: e.message };
  }
}

// ── Cover art embedding ──

function embedFlacCover(flacData, coverBytes) {
  // FLAC format: "fLaC" + METADATA_BLOCKS... + audio frames
  // METADATA_BLOCK: 1 byte header (bit7=last, bits6-0=type) + 3 bytes length (big-endian)
  // STREAMINFO is always first (type 0). We insert PICTURE (type 6) after it.
  
  if (flacData.length < 8) return flacData;
  
  // Parse existing blocks
  let pos = 4; // skip "fLaC"
  const blocks = [];
  
  while (pos < flacData.length) {
    if (pos + 4 > flacData.length) break;
    const header = flacData.readUInt32BE(pos);
    const isLast = (header >> 31) & 1;
    const blockType = (header >> 24) & 0x7F;
    const blockSize = header & 0xFFFFFF;
    pos += 4;
    if (pos + blockSize > flacData.length) break;
    blocks.push({ isLast, blockType, blockSize, data: flacData.subarray(pos, pos + blockSize) });
    pos += blockSize;
    if (isLast) break;
  }
  
  if (blocks.length === 0) return flacData;
  
  // Detect image MIME type
  let mimeType = "image/jpeg";
  if (coverBytes.length >= 4 && coverBytes[0] === 0x89 && coverBytes[1] === 0x50 && coverBytes[2] === 0x4E && coverBytes[3] === 0x47) {
    mimeType = "image/png";
  }
  
  // Build PICTURE block
  const mimeBuf = Buffer.from(mimeType, "utf-8");
  // Picture block: type(4) + mimeLen(4) + mime + descLen(4) + desc + width(4) + height(4) + bpp(4) + colors(4) + picLen(4) + pic
  const desc = Buffer.alloc(0);
  const pictureData = Buffer.alloc(4 + 4 + mimeBuf.length + 4 + desc.length + 4 + 4 + 4 + 4 + 4 + coverBytes.length);
  let off = 0;
  pictureData.writeUInt32BE(3, off); off += 4; // type 3 = front cover
  pictureData.writeUInt32BE(mimeBuf.length, off); off += 4;
  mimeBuf.copy(pictureData, off); off += mimeBuf.length;
  pictureData.writeUInt32BE(desc.length, off); off += 4;
  // desc is empty, skip
  pictureData.writeUInt32BE(0, off); off += 4; // width (0 = unknown)
  pictureData.writeUInt32BE(0, off); off += 4; // height
  pictureData.writeUInt32BE(0, off); off += 4; // bpp
  pictureData.writeUInt32BE(0, off); off += 4; // colors
  pictureData.writeUInt32BE(coverBytes.length, off); off += 4;
  coverBytes.copy(pictureData, off);
  
  const pictureBlockSize = pictureData.length;
  
  // Build new FLAC data with PICTURE block inserted after STREAMINFO (first block)
  const parts = [Buffer.from("fLaC")];
  
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (i === 0) {
      // STREAMINFO: always first, not last anymore
      const hdr = Buffer.alloc(4);
      hdr.writeUInt32BE(((0 << 31) | (block.blockType << 24) | block.blockSize) >>> 0, 0);
      parts.push(hdr);
      parts.push(block.data);
      
      // Insert PICTURE block
      const picHdr = Buffer.alloc(4);
      const picIsLast = blocks.length === 1 ? 1 : 0;
      picHdr.writeUInt32BE(((picIsLast << 31) | (6 << 24) | pictureBlockSize) >>> 0, 0);
      parts.push(picHdr);
      parts.push(pictureData);
      
      // If there was only one block, we"re done
      if (blocks.length === 1) break;
    } else {
      const isLast = (i === blocks.length - 1) ? 1 : 0;
      const hdr = Buffer.alloc(4);
      hdr.writeUInt32BE(((isLast << 31) | (block.blockType << 24) | block.blockSize) >>> 0, 0);
      parts.push(hdr);
      parts.push(block.data);
    }
  }
  
  // Append audio frames
  if (pos < flacData.length) {
    parts.push(flacData.subarray(pos));
  }
  
  return Buffer.concat(parts);
}

function embedMp3Cover(mp3Data, coverBytes) {
  // Check if there"s an existing ID3v2 tag
  const hasId3 = mp3Data.length >= 3 && mp3Data[0] === 0x49 && mp3Data[1] === 0x44 && mp3Data[2] === 0x33;
  
  let audioStart = 0;
  let existingFrames = Buffer.alloc(0);
  
  if (hasId3 && mp3Data.length >= 10) {
    // Parse existing ID3v2 header
    const size = (mp3Data[6] << 21) | (mp3Data[7] << 14) | (mp3Data[8] << 7) | mp3Data[9];
    existingFrames = mp3Data.subarray(10, 10 + size);
    audioStart = 10 + size;
  }
  
  // Build APIC frame
  // frame header: id(4) + size(4) + flags(2)
  // APIC data: textEncoding(1) + mimeType +   + pictureType(1) + description +   + pictureData
  let mimeType = "image/jpeg";
  if (coverBytes.length >= 4 && coverBytes[0] === 0x89 && coverBytes[1] === 0x50 && coverBytes[2] === 0x4E && coverBytes[3] === 0x47) {
    mimeType = "image/png";
  }
  
  const mimeBuf = Buffer.from(mimeType, "utf-8");
  const descBuf = Buffer.from("cover", "utf-8");
  
  const apicData = Buffer.alloc(1 + mimeBuf.length + 1 + 1 + descBuf.length + 1 + coverBytes.length);
  let off = 0;
  apicData[off] = 0; off += 1; // text encoding: ISO-8859-1
  mimeBuf.copy(apicData, off); off += mimeBuf.length;
  apicData[off] = 0; off += 1; // null terminator
  apicData[off] = 3; off += 1; // picture type: front cover
  descBuf.copy(apicData, off); off += descBuf.length;
  apicData[off] = 0; off += 1; // null terminator
  coverBytes.copy(apicData, off);
  
  // frame header
  const frameHeader = Buffer.alloc(10);
  frameHeader.write("APIC", 0, 4, "ascii");
  frameHeader.writeUInt32BE(apicData.length, 4);
  frameHeader.writeUInt16BE(0, 8); // flags
  
  const fullFrames = Buffer.concat([existingFrames, frameHeader, apicData]);
  const totalFrameSize = fullFrames.length;
  
  // Build ID3v2.3 header
  const header = Buffer.alloc(10);
  header.write("ID3", 0, 3, "ascii");
  header.writeUInt16BE(0x0300, 3); // version 2.3
  header[5] = 0; // flags
  // synchsafe size
  header[6] = (totalFrameSize >> 21) & 0x7F;
  header[7] = (totalFrameSize >> 14) & 0x7F;
  header[8] = (totalFrameSize >> 7) & 0x7F;
  header[9] = totalFrameSize & 0x7F;
  
  const audioAfter = audioStart > 0 ? mp3Data.subarray(audioStart) : mp3Data;
  
  return Buffer.concat([header, fullFrames, audioAfter]);
}


// ── Tag stripping (for writeTags=false) ──

function stripMp3Tags(mp3Data) {
  // Remove ID3v2 tag at start, return raw audio frames
  if (mp3Data.length >= 10 && mp3Data[0] === 0x49 && mp3Data[1] === 0x44 && mp3Data[2] === 0x33) {
    const size = (mp3Data[6] << 21) | (mp3Data[7] << 14) | (mp3Data[8] << 7) | mp3Data[9];
    const tagEnd = 10 + size;
    if (tagEnd < mp3Data.length) {
      return mp3Data.subarray(tagEnd);
    }
  }
  return mp3Data;
}

function stripFlacTags(flacData) {
  // Remove VORBIS_COMMENT (type 4) blocks from FLAC metadata
  if (flacData.length < 8) return flacData;
  
  let pos = 4; // skip "fLaC"
  const blocks = [];
  
  while (pos < flacData.length) {
    if (pos + 4 > flacData.length) break;
    const header = flacData.readUInt32BE(pos);
    const isLast = (header >> 31) & 1;
    const blockType = (header >> 24) & 0x7F;
    const blockSize = header & 0xFFFFFF;
    pos += 4;
    if (pos + blockSize > flacData.length) break;
    if (blockType !== 4) { // skip VORBIS_COMMENT
      blocks.push({ isLast, blockType, blockSize, data: flacData.subarray(pos, pos + blockSize) });
    }
    pos += blockSize;
    if (isLast) break;
  }
  
  if (blocks.length === 0) return flacData;
  
  const parts = [Buffer.from("fLaC")];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const isLast = (i === blocks.length - 1) ? 1 : 0;
    const hdr = Buffer.alloc(4);
    hdr.writeUInt32BE(((isLast << 31) | (block.blockType << 24) | block.blockSize) >>> 0, 0);
    parts.push(hdr);
    parts.push(block.data);
  }
  
  if (pos < flacData.length) {
    parts.push(flacData.subarray(pos));
  }
  
  return Buffer.concat(parts);
}


async function decode(params) {
  const filepath = params.filepath || "";
  if (!filepath || !fs.existsSync(filepath)) {
    return { error: "File not found" };
  }

  try {
    const buf = fs.readFileSync(filepath);
    if (!buf.subarray(0, 8).equals(NCM_MAGIC)) {
      return { error: "Not a valid NCM file" };
    }

    const keyLength = buf.readUInt32LE(10);
    const keyData = buf.subarray(14, 14 + keyLength);

    // Derive AES key
    let aesKey;
    try {
      aesKey = deriveAesKey(keyData);
    } catch (e) {
      return { success: false, errorMessage: e.message };
    }

    // Find audio start offset
    const metaStart = 14 + keyLength;
    const metaLength = buf.readUInt32LE(metaStart);
    const coverStart = metaStart + 4 + metaLength + 4 + 5; // + CRC32(4) + Gap2(5)
    let audioStart = coverStart + 4;
    const imageSize = buf.readUInt32LE(coverStart);
    if (imageSize > 0 && imageSize < 10 * 1024 * 1024) {
      audioStart = coverStart + 4 + imageSize;
    }

    const encryptedAudio = buf.subarray(audioStart);
    if (encryptedAudio.length === 0) {
      return { success: false, errorMessage: "No audio data found" };
    }

    // Decrypt audio with NCM stream cipher (yoki123/ncmdump reference)
    // Build RC4-like S-box from the AES key
    const box = buildKeyBox(aesKey);
    const CHUNK = 0x8000;
    const decryptedChunks = [];
    let pos = 0;

    while (pos < encryptedAudio.length) {
      const end = Math.min(pos + CHUNK, encryptedAudio.length);
      const chunk = encryptedAudio.subarray(pos, end);
      const decrypted = Buffer.alloc(chunk.length);

      for (let i = 0; i < chunk.length; i++) {
        const j = (i + 1) & 0xff;
        const k = (box[j] + box[(box[j] + j) & 0xff]) & 0xff;
        decrypted[i] = chunk[i] ^ box[k];
      }

      decryptedChunks.push(decrypted);
      pos = end;
    }

    const decryptedAudio = Buffer.concat(decryptedChunks);

    // Detect format from first bytes
    let ext = ".bin";
    let format = "unknown";
    const head = decryptedAudio.subarray(0, Math.min(4096, decryptedAudio.length));

    // FLAC: "fLaC" at offset 0
    if (head.length >= 4 && head[0] === 0x66 && head[1] === 0x4C && head[2] === 0x61 && head[3] === 0x43) {
      ext = ".flac"; format = "flac";
    }
    // MP3: sync word 0xFFE0+ or ID3v2 "ID3"
    else if ((head[0] === 0xFF && (head[1] & 0xE0) === 0xE0) || (head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33)) {
      ext = ".mp3"; format = "mp3";
    }
    // WAV: "RIFF"..."WAVE"
    else if (head.length >= 12 && head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46
             && head[8] === 0x57 && head[9] === 0x41 && head[10] === 0x56 && head[11] === 0x45) {
      ext = ".wav"; format = "wav";
    }
    // OGG: "OggS"
    else if (head.length >= 4 && head[0] === 0x4F && head[1] === 0x67 && head[2] === 0x67 && head[3] === 0x53) {
      ext = ".ogg"; format = "ogg";
    }
    // Fallback: use metadata format field if header not recognized
    else {
      try {
        const metaStart2 = 14 + keyLength;
        const metaLength2 = buf.readUInt32LE(metaStart2);
        if (metaLength2 > 0) {
          const metaBytes = buf.subarray(metaStart2 + 4, metaStart2 + 4 + metaLength2);
          const rawStr = metaBytes.toString("utf-8").replace(/^ +/, "");
          if (rawStr.startsWith("{")) {
            const m = JSON.parse(rawStr);
            if (m.format === "flac") { ext = ".flac"; format = "flac"; }
            else if (m.format === "mp3") { ext = ".mp3"; format = "mp3"; }
          }
        }
      } catch (_) {}
    }

    // Extract cover image for embedding (reuse already-parsed offsets)
    let coverBytes = null;
    let coverDebug = "";
    try {
      if (typeof imageSize === "number" && imageSize > 0 && imageSize < 10 * 1024 * 1024) {
        coverBytes = buf.subarray(coverStart + 4, coverStart + 4 + imageSize);
        coverDebug = "extracted " + coverBytes.length + " bytes, type=0x" + coverBytes[0]?.toString(16);
      } else {
        coverDebug = "no cover (imageSize=" + imageSize + ")";
      }
    } catch (e) {
      coverDebug = "extract error: " + (e?.message || "unknown");
    }

    // Embed cover art into the decoded audio (respect writeTags toggle)
    const shouldWriteTags = params.writeTags !== false; // default true
    let finalAudio = decryptedAudio;
    let coverEmbedded = false;

    // Strip existing tags from original audio when writeTags is disabled
    if (!shouldWriteTags) {
      if (format === "flac") {
        finalAudio = stripFlacTags(finalAudio);
        coverDebug += " -> tags stripped";
      } else if (format === "mp3") {
        finalAudio = stripMp3Tags(finalAudio);
        coverDebug += " -> tags stripped";
      }
    }

    if (shouldWriteTags && coverBytes && coverBytes.length > 0) {
      try {
        if (format === "flac") {
          finalAudio = embedFlacCover(decryptedAudio, coverBytes);
          coverEmbedded = true;
          coverDebug += " -> FLAC embedded (+" + (finalAudio.length - decryptedAudio.length) + " bytes)";
        } else if (format === "mp3") {
          finalAudio = embedMp3Cover(decryptedAudio, coverBytes);
          coverEmbedded = true;
          coverDebug += " -> MP3 embedded (+" + (finalAudio.length - decryptedAudio.length) + " bytes)";
        } else {
          coverDebug += " -> skipped (unknown format: " + format + ")";
        }
      } catch (e) {
        coverDebug += " -> embed error: " + (e?.message || "unknown");
        finalAudio = decryptedAudio;
      }
    } else if (!shouldWriteTags) {
      coverDebug = "skipped (writeTags disabled)";
    }

    // Build output path
    const outputDir = params.outputDir || path.dirname(filepath);
    const baseName = path.basename(filepath, ".ncm");
    const outPath = path.join(outputDir, baseName + " [Decoded]" + ext);

    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(outPath, finalAudio);

    return {
      success: true,
      outputPath: outPath,
      audioFormat: format,
      originalSize: buf.length,
      decryptedSize: decryptedAudio.length,
      coverEmbedded: coverEmbedded,
      coverDebug: coverDebug || null,
    };
  } catch (e) {
    return { success: false, errorMessage: e.message };
  }
}

async function batchDecode(params) {
  const files = params.files || [];
  if (files.length === 0) return { error: "No files specified" };

  const outputDir = params.outputDir || undefined;
  const results = [];
  let successCount = 0;
  let failCount = 0;

  for (const fp of files) {
    const result = await decode({ filepath: fp, outputDir });
    results.push(result);
    if (result.success) successCount++;
    else failCount++;
  }

  return { results, successCount, failCount };
}

module.exports = { listNcm, getInfo, decode, batchDecode };