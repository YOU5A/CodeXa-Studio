const fs = require("fs");
const path = require("path");
const { RpcBridge } = require("./rpc-bridge");

// Resolve the x64 dotnet CLI path explicitly.
// When spawned from a 32-bit process (e.g. x86 Electron), PATH resolution
// can pick up the x86 dotnet which won't run x64 assemblies.
const DOTNET_EXE = (() => {
  const prog = process.env["ProgramW6432"] || process.env["PROGRAMFILES"] || "C:\Program Files";
  return path.join(prog, "dotnet", "dotnet.exe");
})();

// ---- .NET Bridge (main bridge) ----
function startDotNetBridge(isDev, dotnetBridge) {
  const publishDir = isDev
    ? path.join(__dirname, "..", "dotnet-bridge", "publish")
    : path.join(process.resourcesPath, "dotnet-bridge");
  const dllPath = path.join(publishDir, "CodeXaBridge.dll");
  const dataDir = isDev
    ? path.join(__dirname, "..", "data")
    : path.join(process.resourcesPath, "data");

  if (!fs.existsSync(dllPath)) {
    console.warn("[.NET Bridge] DLL not found at", dllPath, "- JS fallback will handle RPC");
    return false;
  }

  try {
    // Use dotnet exec to let the CLI handle framework resolution and architecture matching.
    dotnetBridge.current = new RpcBridge();
    dotnetBridge.current.start(DOTNET_EXE, ["exec", dllPath, dataDir]);
    console.log("[.NET Bridge] Started via dotnet exec (" + DOTNET_EXE + ")");
    return true;
  } catch (err) {
    console.warn("[.NET Bridge] Init failed:", err.message);
    return false;
  }
}

// ---- Setup: main bridge ----
function setupBridge({ isDev, dotnetBridge, app }) {
  startDotNetBridge(isDev, dotnetBridge);

  app.on("before-quit", () => {
    dotnetBridge.current?.stop();
  });
}

module.exports = { setupBridge };
