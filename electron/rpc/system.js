const { execSync } = require("child_process");
const os = require("os");

// Cached previous CPU times for delta calculation across calls
let prevCpuIdle = 0;
let prevCpuTotal = 0;

/** Compute CPU percentage via os.cpus() delta between successive calls. */
function getCpuPercent() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    idle += cpu.times.idle;
    total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq;
  }

  if (prevCpuTotal > 0 && total > prevCpuTotal) {
    const idleDelta = idle - prevCpuIdle;
    const totalDelta = total - prevCpuTotal;
    prevCpuIdle = idle;
    prevCpuTotal = total;
    return Math.round((1 - idleDelta / totalDelta) * 100);
  }

  // First call after module load: no delta yet
  prevCpuIdle = idle;
  prevCpuTotal = total;
  return 0;
}

function systemInfo() {
  let isAdmin = false;
  try {
    execSync("net session", { stdio: "ignore" });
    isAdmin = true;
  } catch {}

  return {
    cpu_percent: getCpuPercent(),
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
