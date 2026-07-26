const system = require("./system");
const registry = require("./registry");
const admin = require("./admin");
const priority = require("./priority");
const music = require("./music");
const backup = require("./backup");
const config = require("./config");
const ncm = require("./ncm");

/**
 * Route an RPC method call and return the result.
 * Mirrors the Python bridge/server.py METHOD dispatch.
 * @param {string} method - RPC method name (e.g. "system.info")
 * @param {object} params - Parameters object
 * @returns {Promise<object>} Result object
 */
async function callMethod(method, params = {}) {
  switch (method) {
    // ── System Info ──
    case "system.info":
      return await system.systemInfo();

    // ── Registry ──
    case "registry.read":
      return registry.readValue();
    case "registry.write":
      return registry.writeValue(params.value);
    case "registry.backup": {
      const current = registry.readValue();
      if (current.value === null) {
        return { error: "Failed to read registry value. Administrator privileges may be required." };
      }
      return registry.backupValue(current.value);
    }

    // ── Admin ──
    case "admin.check":
      return { is_admin: admin.isAdmin() };
    case "admin.restart": {
      const isAdmin = admin.isAdmin();
      if (isAdmin) return { success: true, already_admin: true };
      return {
        success: false,
        requires_admin: true,
        message: "Administrator privileges required. Please restart CodeXa Studio as Administrator.",
      };
    }

    // ── Priority Rules ──
    case "priority.list":
      return priority.listApps();
    case "priority.add":
      return priority.addOrEdit(params);
    case "priority.edit":
      return priority.addOrEdit(params);
    case "priority.delete":
      return priority.removeApp(params);
    case "priority.export":
      return priority.exportConfig(params);
    case "priority.import_config":
      return priority.importConfig(params);

    // ── Music ──
    case "music.scan":
      return music.scanFolder(params);
    case "music.get_metadata":
      return await music.getMetadata(params);
    case "music.save_tags":
      return music.saveTags(params);
    case "music.extract_cover":
      return await music.extractCover(params);
    case "music.apply_cover":
      return music.applyCover(params);
    case "music.remove_cover":
      return music.removeCover(params);
    case "music.read_cover_file":
      return music.readCoverFile(params);
    case "music.save_cover_file":
      return music.saveCoverFile(params);
    case "music.rename":
      return await music.renameFile(params);
    case "music.get_lyrics":
      return await music.getLyrics(params);

    // ── NCM ──
    case "ncm.list":
      return await ncm.listNcm(params);
    case "ncm.get_info":
      return await ncm.getInfo(params);
    case "ncm.decode":
      return await ncm.decode(params);
    case "ncm.batch_decode":
      return await ncm.batchDecode(params);

    // ── Backups ──
    case "backup.list":
      return backup.listBackups();
    case "backup.dir":
      return backup.getBackupDir();
    case "backup.export":
      return backup.exportBackup(params);
    case "backup.restore":
      return backup.restoreBackup(params);
    case "backup.delete":
      return backup.deleteBackup(params);
    case "backup.clear_all":
      return backup.clearAllBackups();

    // ── Config ──
    case "config.get":
      return config.getConfig();
    case "config.set":
      return config.setConfig(params);

    default:
      return { error: `Unknown method: ${method}` };
  }
}

module.exports = { callMethod };