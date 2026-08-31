const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const KEY_PATH = "HKLM\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl";
const VALUE_NAME = "Win32PrioritySeparation";
const BACKUP_DIR = "C:\\CodeXaStudio\\backups";
const GPU_BACKUP_DIR = "C:\\CodeXaStudio\\gpu-backups";

function readValue() {
  try {
    const cmd = `reg query "${KEY_PATH}" /v ${VALUE_NAME}`;
    const output = execSync(cmd, { encoding: "utf-8", windowsHide: true });
    const match = output.match(/Win32PrioritySeparation\s+REG_DWORD\s+0x([0-9a-fA-F]+)/);
    if (match) {
      const value = parseInt(match[1], 16);
      const binary = value.toString(2).padStart(32, "0")
        .match(/.{1,8}/g).join(" ");
      return { value, decimal: value, hex: `0x${value.toString(16).toUpperCase().padStart(8, "0")}`, binary };
    }
    return { error: "Failed to read registry", value: null };
  } catch (e) {
    return { error: e.message, value: null };
  }
}

function writeValue(value) {
  try {
    execSync(`reg add "${KEY_PATH}" /v ${VALUE_NAME} /t REG_DWORD /d ${value} /f`, { windowsHide: true });
    return readValue();
  } catch (e) {
    return { error: e.message, success: false };
  }
}

function backupValue(value) {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const hexStr = value.toString(16).toUpperCase().padStart(8, "0");
    const filename = `${timestamp}_${value}_0x${hexStr}.reg`;
    const filepath = path.join(BACKUP_DIR, filename);

    const content = `Windows Registry Editor Version 5.00\r\n\r\n[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl]\r\n"Win32PrioritySeparation"=dword:${hexStr}\r\n`;
    fs.writeFileSync(filepath, content, "utf-8");
    return { filename, filepath, value };
  } catch (e) {
    return { error: e.message };
  }
}

function detectGpu() {
  try {
    const wmiRaw = execSync('powershell -NoProfile -Command "Get-CimInstance Win32_VideoController | Select-Object Name,PNPDeviceID | ConvertTo-Json -Compress"', { encoding: "utf-8", windowsHide: true }).trim();
    const wmi = wmiRaw ? JSON.parse(wmiRaw) : [];
    const controllers = Array.isArray(wmi) ? wmi : [wmi];
    const adapters = controllers.filter(x => String(x.PNPDeviceID || '').toUpperCase().startsWith('PCI\\')).map(x => {
      const regPath = `SYSTEM\\CurrentControlSet\\Enum\\${x.PNPDeviceID}`;
      let desc = x.Name || '';
      try { const q = execSync(`reg query "HKLM\\${regPath}" /v DeviceDesc`, { encoding: "utf-8", windowsHide: true }); desc = q.match(/DeviceDesc\s+REG_SZ\s+(.+)/i)?.[1]?.trim() || desc; } catch {}
      return { name: desc.includes(';') ? desc.slice(desc.lastIndexOf(';') + 1) : desc, deviceDesc: desc, path: regPath };
    });
    let isLaptop = false;
    try { const type = execSync('powershell -NoProfile -Command "(Get-CimInstance Win32_ComputerSystem).PCSystemType"', { encoding: "utf-8", windowsHide: true }).trim(); isLaptop = ["2", "8"].includes(type); } catch {}
    return { adapters, formFactor: isLaptop ? "laptop" : "desktop", isLaptop };
  } catch (e) {
    try {
    const output = execSync('reg query "HKLM\\SYSTEM\\CurrentControlSet\\Enum\\PCI" /s', { encoding: "utf-8", windowsHide: true });
    const adapters = [];
    for (const block of output.split(/\r?\n\s*\r?\n/)) {
      const pathMatch = block.match(/^HKEY_LOCAL_MACHINE\\(.+)$/im);
      if (!pathMatch || !/Class\s+REG_SZ\s+Display/i.test(block)) continue;
      const desc = block.match(/DeviceDesc\s+REG_SZ\s+(.+)/i)?.[1]?.trim() ?? "";
      const regPath = pathMatch[1].trim();
      adapters.push({ name: desc.includes(";") ? desc.slice(desc.lastIndexOf(";") + 1) : desc, deviceDesc: desc, path: regPath });
    }
    let isLaptop = false;
    return { adapters, formFactor: isLaptop ? "laptop" : "desktop", isLaptop };
    return { adapters, formFactor: "desktop", isLaptop };
    } catch (fallbackError) { return { adapters: [], formFactor: "desktop", isLaptop: false, error: fallbackError.message }; }
  }
}

function writeGpuName({ path: regPath, name }) {
  if (!regPath || !name || name.length > 128) return { error: "Invalid GPU name or registry path." };
  try {
    const query = execSync(`reg query "HKLM\\${regPath}" /v DeviceDesc`, { encoding: "utf-8", windowsHide: true });
    const line = query.split(/\r?\n/).find(x => /DeviceDesc/i.test(x));
    const current = line?.replace(/^.*REG_SZ\s+/, "") ?? "";
    const prefix = current.includes(";") ? current.slice(0, current.lastIndexOf(";") + 1) : "";
    execSync(`reg add "HKLM\\${regPath}" /v DeviceDesc /t REG_SZ /d "${prefix}${String(name).replace(/"/g, "\\\"")}" /f`, { windowsHide: true });
    return { success: true, name };
  } catch (e) { return { error: e.message, success: false }; }
}

function gpuBackupCreate() {
  try { fs.mkdirSync(GPU_BACKUP_DIR, { recursive: true }); const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14); const detection = detectGpu(); const filename = `${stamp}_gpu.json`; const filepath = path.join(GPU_BACKUP_DIR, filename); fs.writeFileSync(filepath, JSON.stringify({ createdAt: new Date().toISOString(), adapters: detection.adapters || [] }, null, 2), "utf8"); return { success: true, filename, filepath }; } catch (e) { return { error: e.message }; }
}
function gpuBackupList() { try { if (!fs.existsSync(GPU_BACKUP_DIR)) return { backups: [] }; return { backups: fs.readdirSync(GPU_BACKUP_DIR).filter(f => f.endsWith('.json')).map(filename => { const filepath = path.join(GPU_BACKUP_DIR, filename); const stat = fs.statSync(filepath); const data = JSON.parse(fs.readFileSync(filepath, 'utf8')); return { filename, filepath, names: (data.adapters || []).map(a => a.name).join(' · '), date: stat.mtime.toLocaleDateString(), time: stat.mtime.toLocaleTimeString(), size: stat.size }; }).sort((a,b) => b.filepath.localeCompare(a.filepath)) }; } catch (e) { return { error: e.message, backups: [] }; } }
function gpuBackupRestore(filepath) { try { const data = JSON.parse(fs.readFileSync(filepath, 'utf8')); for (const a of data.adapters || []) writeGpuName({ path: a.path, name: a.name }); return { success: true }; } catch (e) { return { error: e.message }; } }
function gpuBackupDelete(filename) { try { const filepath = path.join(GPU_BACKUP_DIR, filename); if (!fs.existsSync(filepath)) return { error: 'Backup file not found' }; fs.unlinkSync(filepath); return { success: true }; } catch (e) { return { error: e.message }; } }
function gpuBackupClear() { try { if (!fs.existsSync(GPU_BACKUP_DIR)) return { deleted: 0 }; let deleted = 0; for (const filename of fs.readdirSync(GPU_BACKUP_DIR)) if (filename.endsWith('.json')) { fs.unlinkSync(path.join(GPU_BACKUP_DIR, filename)); deleted++; } return { deleted }; } catch (e) { return { error: e.message }; } }

function detectGpuAsync() {
  const { exec } = require("child_process");
  const run = command => new Promise((resolve, reject) => exec(command, { encoding: "utf8", windowsHide: true, maxBuffer: 1024 * 1024 }, (error, stdout) => error ? reject(error) : resolve(stdout)));
  return Promise.all([
    run('powershell -NoProfile -Command "Get-CimInstance Win32_VideoController | Select-Object Name,PNPDeviceID | ConvertTo-Json -Compress"'),
    run('powershell -NoProfile -Command "(Get-CimInstance Win32_ComputerSystem).PCSystemType"'),
  ]).then(async ([raw, type]) => {
    const parsed = raw.trim() ? JSON.parse(raw) : [];
    const controllers = Array.isArray(parsed) ? parsed : [parsed];
    const adapters = [];
    for (const c of controllers) {
      if (!String(c.PNPDeviceID || "").toUpperCase().startsWith("PCI\\")) continue;
      const regPath = `SYSTEM\\CurrentControlSet\\Enum\\${c.PNPDeviceID}`;
      let desc = c.Name || "";
      try { const q = await run(`reg query "HKLM\\${regPath}" /v DeviceDesc`); desc = q.match(/DeviceDesc\s+REG_SZ\s+(.+)/i)?.[1]?.trim() || desc; } catch {}
      adapters.push({ name: desc.includes(";") ? desc.slice(desc.lastIndexOf(";") + 1) : desc, deviceDesc: desc, path: regPath });
    }
    const isLaptop = ["2", "8"].includes(String(type).trim());
    return { adapters, formFactor: isLaptop ? "laptop" : "desktop", isLaptop };
  }).catch(e => ({ adapters: [], formFactor: "desktop", isLaptop: false, error: e.message }));
}

module.exports = { readValue, writeValue, backupValue, detectGpu, detectGpuAsync, writeGpuName, gpuBackupCreate, gpuBackupList, gpuBackupRestore, gpuBackupDelete, gpuBackupClear, BACKUP_DIR, GPU_BACKUP_DIR };
