const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const BASE_PATH = "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options";

function listApps() {
  try {
    const output = execSync(`reg query "${BASE_PATH}"`, { encoding: "utf-8", windowsHide: true });
    const lines = output.split("\n").filter(l => l.startsWith("HKEY_LOCAL_MACHINE"));
    const apps = [];

    for (const line of lines) {
      const subkeyName = line.split("\\").pop().trim();
      if (!subkeyName || subkeyName.includes("PerfOptions")) continue;

      let cpuVal = null;
      let ioVal = null;
      try {
        const perfOutput = execSync(`reg query "${BASE_PATH}\\${subkeyName}\\PerfOptions"`, { encoding: "utf-8", windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
        const cpuMatch = perfOutput.match(/CpuPriorityClass\s+REG_DWORD\s+0x([0-9a-fA-F]+)/);
        if (cpuMatch) cpuVal = parseInt(cpuMatch[1], 16);
        const ioMatch = perfOutput.match(/IoPriority\s+REG_DWORD\s+0x([0-9a-fA-F]+)/);
        if (ioMatch) ioVal = parseInt(ioMatch[1], 16);
      } catch {}

      if (cpuVal !== null || ioVal !== null) {
        apps.push({
          name: subkeyName,
          cpu_priority: cpuVal !== null ? String(cpuVal) : "-",
          io_priority: ioVal !== null ? String(ioVal) : "-",
        });
      }
    }
    return { applications: apps };
  } catch (e) {
    return { error: e.message, applications: [] };
  }
}

function addOrEdit(params) {
  let name = (params.name || "").trim();
  if (!name) return { error: "Application name required" };
  if (!name.toLowerCase().endsWith(".exe")) name += ".exe";

  try {
    // Ensure the IFEO key exists
    execSync(`reg add "${BASE_PATH}\\${name}" /f`, { stdio: "ignore", windowsHide: true });
    execSync(`reg add "${BASE_PATH}\\${name}\\PerfOptions" /f`, { stdio: "ignore", windowsHide: true });

    if (params.cpu_priority !== undefined && params.cpu_priority !== null) {
      execSync(
        `reg add "${BASE_PATH}\\${name}\\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d ${params.cpu_priority} /f`,
        { windowsHide: true }
      );
    }
    if (params.io_priority !== undefined && params.io_priority !== null) {
      execSync(
        `reg add "${BASE_PATH}\\${name}\\PerfOptions" /v IoPriority /t REG_DWORD /d ${params.io_priority} /f`,
        { windowsHide: true }
      );
    }
    return { success: true };
  } catch (e) {
    if (e.message.includes("Access is denied") || e.message.includes("denied")) {
      return { error: "Administrator privileges required. Please restart CodeXa Studio as Administrator." };
    }
    return { error: e.message };
  }
}

function removeApp(params) {
  const name = (params.name || "").trim();
  if (!name) return { error: "Application name required" };

  try {
    try {
      execSync(
        `reg delete "${BASE_PATH}\\${name}\\PerfOptions" /v CpuPriorityClass /f`,
        { stdio: "ignore", windowsHide: true }
      );
    } catch {}
    try {
      execSync(
        `reg delete "${BASE_PATH}\\${name}\\PerfOptions" /v IoPriority /f`,
        { stdio: "ignore", windowsHide: true }
      );
    } catch {}
    // Delete PerfOptions subkey
    try {
      execSync(`reg delete "${BASE_PATH}\\${name}\\PerfOptions" /f`, { stdio: "ignore", windowsHide: true });
    } catch {}
    return { success: true };
  } catch (e) {
    if (e.message.includes("Access is denied") || e.message.includes("denied")) {
      return { error: "Administrator privileges required. Please restart CodeXa Studio as Administrator." };
    }
    return { error: e.message };
  }
}

function exportConfig(params) {
  const result = listApps();
  const apps = result.applications || [];
  if (!apps.length) return { error: "No configurations to export" };

  const filepath = params.filepath || path.join(__dirname, "..", "..", "data", "AppCpuPriority_export.json");
  fs.writeFileSync(filepath, JSON.stringify(apps, null, 2), "utf-8");
  return { success: true, filepath, count: apps.length };
}

function importConfig(params) {
  const filepath = params.filepath;
  if (!filepath) return { error: "Missing 'filepath' parameter" };

  let apps;
  try {
    apps = JSON.parse(fs.readFileSync(filepath, "utf-8"));
  } catch (e) {
    return { error: `Failed to read file: ${e.message}` };
  }

  let imported = 0;
  let failed = 0;
  for (const app of apps) {
    const result = addOrEdit({
      name: app.name,
      cpu_priority: Number(app.cpu_priority),
      io_priority: Number(app.io_priority),
    });
    if (result.success) imported++;
    else failed++;
  }
  return { imported, failed };
}

module.exports = { listApps, addOrEdit, removeApp, exportConfig, importConfig };
