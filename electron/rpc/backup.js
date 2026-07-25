const fs = require("fs");
const path = require("path");

const BACKUP_DIR = "C:\\CodeXaStudio\\backups";

function listBackups() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return { backups: [] };

    const pattern = /^(\d{8}_\d{6})_(\d+)_0x([0-9A-F]{8})\.reg$/i;
    const backups = [];

    for (const filename of fs.readdirSync(BACKUP_DIR)) {
      if (!filename.toLowerCase().endsWith(".reg")) continue;
      const filepath = path.join(BACKUP_DIR, filename);
      let stat;
      try { stat = fs.statSync(filepath); } catch { continue; }

      const match = filename.match(pattern);
      let entry;
      if (match) {
        const ts = match[1];
        entry = {
          filename,
          filepath,
          date: `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`,
          time: `${ts.slice(9, 11)}:${ts.slice(11, 13)}:${ts.slice(13, 15)}`,
          decimal: parseInt(match[2], 10),
          hex: `0x${match[3]}`,
          mtime: stat.mtimeMs / 1000,
          size: stat.size,
          module: "win32",
        };
      } else {
        const dt = stat.mtime;
        const pad = (n) => String(n).padStart(2, "0");
        let decimal = 0;
        for (const part of filename.split("_")) {
          if (/^\d+$/.test(part)) { decimal = parseInt(part, 10); break; }
        }
        entry = {
          filename,
          filepath,
          date: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`,
          time: `${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`,
          decimal,
          hex: "0x00000000",
          mtime: stat.mtimeMs / 1000,
          size: stat.size,
          module: "win32",
        };
      }
      backups.push(entry);
    }

    backups.sort((a, b) => b.mtime - a.mtime);
    return { backups };
  } catch (e) {
    return { error: e.message, backups: [] };
  }
}

function getBackupDir() {
  return { dir: BACKUP_DIR };
}

function exportBackup(params) {
  const { filepath, dest } = params;
  if (!filepath || !dest) return { error: "Missing filepath or dest parameter" };
  if (!fs.existsSync(filepath)) return { error: "Source file not found" };
  try {
    fs.copyFileSync(filepath, dest);
    return { success: true };
  } catch (e) {
    return { error: e.message };
  }
}

function restoreBackup(params) {
  const { filepath } = params;
  if (!filepath) return { error: "Missing 'filepath' parameter" };
  if (!fs.existsSync(filepath)) return { error: "Backup file not found" };

  const filename = path.basename(filepath);
  const pattern = /^(\d{8}_\d{6})_(\d+)_0x([0-9A-F]{8})\.reg$/i;
  const match = filename.match(pattern);
  if (!match) return { error: "Invalid backup filename format" };

  const decimalValue = parseInt(match[2], 10);
  if (isNaN(decimalValue)) return { error: "Invalid decimal value in backup filename" };

  // Backup current value before restoring (delegated to registry module)
  const registry = require("./registry");

  const current = registry.readValue();
  if (current.value !== null && current.value !== undefined) {
    try {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      registry.backupValue(current.value);
    } catch {}
  }

  return registry.writeValue(decimalValue);
}

function deleteBackup(params) {
  const { filename } = params;
  if (!filename) return { error: "Missing 'filename' parameter" };
  const filepath = path.join(BACKUP_DIR, filename);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
    return { success: true };
  }
  return { error: "File not found" };
}

function clearAllBackups() {
  let deleted = 0;
  if (fs.existsSync(BACKUP_DIR)) {
    for (const f of fs.readdirSync(BACKUP_DIR)) {
      const fp = path.join(BACKUP_DIR, f);
      try {
        if (fs.statSync(fp).isFile()) {
          fs.unlinkSync(fp);
          deleted++;
        }
      } catch {}
    }
  }
  return { deleted };
}

module.exports = { listBackups, getBackupDir, exportBackup, restoreBackup, deleteBackup, clearAllBackups };
