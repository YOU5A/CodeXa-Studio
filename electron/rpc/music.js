const fs = require("fs");
const path = require("path");
const { parseFile } = require("music-metadata");
const NodeID3 = require("node-id3");
const iconv = require("iconv-lite");

const SUPPORTED_EXTENSIONS = [".mp3", ".flac", ".ogg", ".m4a", ".mp4a", ".wav", ".opus"];

// ── Helper: walk directory recursively ──
function walkDir(dir, extensions, files = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return files; }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, extensions, files);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (extensions.includes(ext)) files.push(fullPath);
    }
  }
  return files;
}

// ── Helper: sanitize filename ──
function sanitizeFilename(name) {
  if (!name) return "";
  const illegal = /[\/\\:*?"<>|]/g;
  name = name.replace(illegal, "");
  name = name.replace(/\s+/g, " ").trim();
  return name.substring(0, 100);
}

// ── music.scan ──
function scanFolder(params) {
  const folder = params.folder || "";
  const extensions = params.extensions || SUPPORTED_EXTENSIONS;
  const recursive = params.recursive !== false;

  if (!folder || !fs.existsSync(folder)) {
    return { error: `Folder does not exist: ${folder}`, files: [] };
  }

  let files;
  if (recursive) {
    files = walkDir(folder, extensions.map(e => e.toLowerCase()));
  } else {
    files = [];
    try {
      for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (extensions.map(e => e.toLowerCase()).includes(ext)) {
            files.push(path.join(folder, entry.name));
          }
        }
      }
    } catch {}
  }

  files.sort((a, b) => path.basename(a).toLowerCase().localeCompare(path.basename(b).toLowerCase()));
  return { files, count: files.length };
}

// ── music.get_metadata ──
async function getMetadata(params) {
  const filepath = params.filepath || "";
  if (!filepath || !fs.existsSync(filepath)) {
    return { error: "File not found" };
  }

  try {
    const meta = await parseFile(filepath);
    const common = meta.common || {};
    let cover = null;
    if (common.picture && common.picture.length > 0) {
      cover = common.picture[0].data.toString("base64");
    } else {
      // Fallback: try node-id3 for APIC frames on MP3
      try {
        const id3Tags = NodeID3.read(filepath);
        if (id3Tags && id3Tags.image && id3Tags.image.imageBuffer) {
          cover = id3Tags.image.imageBuffer.toString("base64");
        }
      } catch {}
    }

    return {
      title: common.title || "",
      artist: common.artist || "",
      album: common.album || "",
      year: String(common.year || ""),
      genre: (common.genre && common.genre.length > 0) ? common.genre[0] : "",
      track: common.track?.no ? String(common.track.no) : "",
      has_cover: !!cover,
      cover,
    };
  } catch (e) {
    return { title: "", artist: "", album: "", year: "", genre: "", track: "", has_cover: false, cover: null, error: e.message };
  }
}

// ── music.save_tags ──
function saveTags(params) {
  const filepath = params.filepath;
  if (!filepath) return { error: "Missing 'filepath' parameter" };

  const ext = path.extname(filepath).toLowerCase();

  try {
    // Ensure writable
    try { fs.chmodSync(filepath, 0o666); } catch {}

    if (ext === ".mp3") {
      const existingTags = NodeID3.read(filepath) || {};
      const tags = { ...existingTags };

      if (params.title) tags.title = params.title;
      if (params.artist) tags.artist = params.artist;
      if (params.album) tags.album = params.album;
      if (params.year) tags.year = params.year;
      if (params.genre) tags.genre = params.genre;
      if (params.track) tags.trackNumber = params.track;

      // Preserve cover if updating
      if (existingTags.image && !params.title && !params.artist) {
        tags.image = existingTags.image;
      }

      NodeID3.write(tags, filepath);
      return { success: true };
    }

    // For non-MP3 formats, writing tags is not yet supported via Node.js
    return { error: `Tag writing is currently supported for MP3 files only. ${ext.toUpperCase()} support coming soon.` };
  } catch (e) {
    return { error: e.message };
  }
}

// ── music.extract_cover ──
async function extractCover(params) {
  const filepath = params.filepath || "";
  if (!filepath) return { error: "Missing 'filepath' parameter", cover: null };

  try {
    // Try music-metadata first
    const meta = await parseFile(filepath, { skipCovers: false });
    if (meta.common.picture && meta.common.picture.length > 0) {
      return { cover: meta.common.picture[0].data.toString("base64") };
    }

    // Fallback: try node-id3 for MP3
    const ext = path.extname(filepath).toLowerCase();
    if (ext === ".mp3") {
      const id3Tags = NodeID3.read(filepath);
      if (id3Tags && id3Tags.image && id3Tags.image.imageBuffer) {
        return { cover: id3Tags.image.imageBuffer.toString("base64") };
      }
    }

    return { cover: null };
  } catch (e) {
    return { cover: null, error: e.message };
  }
}

// ── music.apply_cover ──
function applyCover(params) {
  const { filepath, cover_path, cover_base64, mime_type } = params;
  if (!filepath || (!cover_path && !cover_base64)) return { error: "Missing parameters" };

  const ext = path.extname(filepath).toLowerCase();

  try {
    try { fs.chmodSync(filepath, 0o666); } catch {}

    const coverData = cover_path ? fs.readFileSync(cover_path) : Buffer.from(cover_base64, "base64");
    const mime = mime_type || "image/jpeg";

    if (ext === ".mp3") {
      const existingTags = NodeID3.read(filepath) || {};
      const tags = { ...existingTags };
      tags.image = {
        mime,
        type: { id: 3, name: "front cover" },
        description: "Cover",
        imageBuffer: coverData,
      };
      NodeID3.write(tags, filepath);
      return { success: true };
    }

    return { error: `Cover writing is currently supported for MP3 files only. ${ext.toUpperCase()} support coming soon.` };
  } catch (e) {
    return { error: e.message };
  }
}

// ── music.remove_cover ──
function removeCover(params) {
  const filepath = params.filepath;
  if (!filepath) return { error: "Missing 'filepath' parameter" };

  const ext = path.extname(filepath).toLowerCase();

  try {
    try { fs.chmodSync(filepath, 0o666); } catch {}

    if (ext === ".mp3") {
      const tags = NodeID3.read(filepath);
      if (tags) {
        delete tags.image;
        NodeID3.write(tags, filepath);
      }
      return { success: true };
    }

    return { error: `Cover removal is currently supported for MP3 files only. ${ext.toUpperCase()} support coming soon.` };
  } catch (e) {
    return { error: e.message };
  }
}

// ── music.read_cover_file ──
function readCoverFile(params) {
  const filepath = params.filepath || "";
  if (!filepath || !fs.existsSync(filepath)) {
    return { error: "File not found", cover: null };
  }
  try {
    const data = fs.readFileSync(filepath);
    return { cover: data.toString("base64") };
  } catch (e) {
    return { error: e.message, cover: null };
  }
}

// ── music.save_cover_file ──
function saveCoverFile(params) {
  const { filepath, base64, ext } = params;
  if (!filepath || !base64) return { error: "Missing parameters" };
  try {
    const data = Buffer.from(base64, "base64");
    fs.writeFileSync(filepath, data);
    return { success: true };
  } catch (e) {
    return { error: e.message };
  }
}

// ── music.rename ──
async function renameFile(params) {
  const filepath = params.filepath;
  let newName = params.new_name;

  if (!filepath) return { error: "Missing 'filepath' parameter" };

  const dirPath = path.dirname(filepath);
  const ext = path.extname(filepath);

  if (newName) {
    const sanitized = sanitizeFilename(newName);
    const newPath = path.join(dirPath, sanitized + ext);
    if (newPath === filepath) return { error: "New name is same as current name" };
    try {
      fs.renameSync(filepath, newPath);
      return { success: true, new_path: newPath };
    } catch (e) {
      return { error: e.message };
    }
  }

  // Try to rename based on title tag
  try {
    const meta = await parseFile(filepath);
    const title = meta.common.title || "";
    if (!title) return { error: "No title found" };
    const sanitized = sanitizeFilename(title);
    const newPath = path.join(dirPath, sanitized + ext);
    if (newPath === filepath) return { error: "New name is same as current name" };
    fs.renameSync(filepath, newPath);
    return { success: true, new_path: newPath };
  } catch (e) {
    return { error: e.message };
  }
}

// ── music.get_lyrics ──
// Strict lyric decoding: UTF-8 fatal → gbk → gb2312 → shift_jis → latin1
function decodeLyricsStrict(bytes) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {}
  for (const enc of ["gbk", "gb2312", "shift_jis"]) {
    try {
      return iconv.decode(bytes, enc);
    } catch {}
  }
  return new TextDecoder("latin1").decode(bytes);
}

async function getLyrics(params) {
  const filepath = params.filepath || "";
  if (!filepath) return { error: "Missing filepath", lyrics_text: null };

  // 1. Check for .lrc file alongside the audio file
  const base = path.join(path.dirname(filepath), path.basename(filepath, path.extname(filepath)));
  for (const lrcExt of [".lrc", ".LRC"]) {
    const lrcPath = base + lrcExt;
    if (fs.existsSync(lrcPath)) {
      const text = decodeLyricsStrict(fs.readFileSync(lrcPath));
      if (text != null) return { lyrics_text: text };
    }
  }

  // 2. Fall back to embedded lyrics via music-metadata
  try {
    const meta = await parseFile(filepath, { duration: false, skipCovers: true });
    // Check for lyrics in native tags
    if (meta.native) {
      // MP3: USLT
      for (const [tagType, entries] of Object.entries(meta.native)) {
        for (const entry of entries) {
          if (entry.id === "USLT" || entry.id === "unsynchronisedLyrics") {
            if (entry.value && entry.value.text) return { lyrics_text: entry.value.text };
            if (typeof entry.value === "string") return { lyrics_text: entry.value };
          }
        }
      }
    }
  } catch {}

  return { lyrics_text: null };
}

module.exports = {
  scanFolder, getMetadata, saveTags, extractCover, applyCover,
  removeCover, readCoverFile, saveCoverFile, renameFile, getLyrics,
};
