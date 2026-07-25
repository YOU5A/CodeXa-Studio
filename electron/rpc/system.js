const { execSync } = require("child_process");
const si = require("systeminformation");
const os = require("os");

async function systemInfo() {
  try {
    const [cpuLoad, cpuInfo, memInfo, fsSizes] = await Promise.all([
      si.currentLoad(),
      si.cpu(),
      si.mem(),
      si.fsSize(),
    ]);

    const dataDrive = fsSizes.find(f => f.mount === "C:") || fsSizes[0] || {};

    let isAdmin = false;
    try {
      execSync("net session", { stdio: "ignore" });
      isAdmin = true;
    } catch {}

    return {
      cpu_percent: Math.round(cpuLoad.currentLoad),
      cpu_count: os.cpus().length,
      cpu_count_physical: cpuInfo.physicalCores,
      memory_total: memInfo.total,
      memory_used: memInfo.used,
      memory_available: memInfo.available,
      memory_percent: Math.round((memInfo.used / memInfo.total) * 100),
      disk_total: dataDrive.size || 0,
      disk_used: dataDrive.used || 0,
      disk_percent: dataDrive.use ? Math.round(dataDrive.use) : 0,
      windows_version: os.version ? os.version().split(".").slice(0, 3).join(".") : "",
      windows_release: "",
      windows_build: os.version ? os.version().split(".").pop() : "",
      windows_edition: "",
      hostname: os.hostname(),
      is_admin: isAdmin,
    };
  } catch (e) {
    return {
      error: e.message,
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
      windows_version: "",
      windows_release: "",
      windows_build: "",
      windows_edition: "",
      hostname: os.hostname(),
      is_admin: false,
    };
  }
}

module.exports = { systemInfo };
