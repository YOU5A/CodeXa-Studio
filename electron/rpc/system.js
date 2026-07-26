const { execSync } = require("child_process");
const os = require("os");

// System info is now served by the .NET Bridge SystemInfoService (via IPC python:call).
// This module retains a lightweight os-based fallback for when no bridge is available.
async function systemInfo() {
  let isAdmin = false;
  try {
    execSync("net session", { stdio: "ignore" });
    isAdmin = true;
  } catch {}

  return {
    cpu_percent: 0,
    cpu_count: os.cpus().length,
    cpu_count_physical: os.cpus().length,
    memory_total: os.totalmem(),
    memory_used: os.totalmem() - os.freemem(),
    memory_available: os.freemem(),
    memory_percent: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100),
    disk_total: 0,
    disk_used: 0,
    disk_percent: 0,
    windows_version: os.version ? os.version().split(".").slice(0, 3).join(".") : "",
    windows_release: "",
    windows_build: os.version ? os.version().split(".").pop() : "",
    windows_edition: "",
    hostname: os.hostname(),
    is_admin: isAdmin,
  };
}

module.exports = { systemInfo };
