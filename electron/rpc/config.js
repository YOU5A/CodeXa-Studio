const fs = require("fs");
const path = require("path");

let configCache = null;
let configPath = null;

function initConfigPath(appDataPath) {
  configPath = path.join(appDataPath, "config.json");
  // Also check data/ folder in project root for dev mode
  const devPath = path.join(__dirname, "..", "..", "data", "config.json");
  if (!fs.existsSync(configPath) && fs.existsSync(devPath)) {
    configPath = devPath;
  }
}

function getConfig() {
  try {
    if (!configPath) return {};
    if (fs.existsSync(configPath)) {
      configCache = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      return configCache;
    }
  } catch {}
  return {};
}

function setConfig(params) {
  try {
    if (!configPath) return { success: false, error: "Config path not initialized" };
    const cfg = getConfig();
    for (const [key, value] of Object.entries(params)) {
      cfg[key] = value;
    }
    configCache = cfg;
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), "utf-8");
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

module.exports = { initConfigPath, getConfig, setConfig };
