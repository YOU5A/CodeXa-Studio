const fs = require("fs");
const path = require("path");
const { PythonBridge } = require("./python-bridge");

// ---- .NET Bridge (???) ----
function startDotNetBridge(isDev, dotnetBridge) {
  const exePath = isDev
    ? path.join(__dirname, "..", "dotnet-bridge", "publish", "CodeXaBridge.exe")
    : path.join(process.resourcesPath, "dotnet-bridge", "CodeXaBridge.exe");
  const dataDir = isDev
    ? path.join(__dirname, "..", "data")
    : path.join(process.resourcesPath, "data");

  if (!fs.existsSync(exePath)) {
    console.warn("[.NET Bridge] Executable not found at", exePath, "- will use Python fallback");
    return false;
  }

  try {
    const { spawn } = require("child_process");
    dotnetBridge.current = new PythonBridge(exePath);

    const originalStart = dotnetBridge.current.start.bind(dotnetBridge.current);
    dotnetBridge.current.start = () => {
      const proc = spawn(exePath, [dataDir], { stdio: ["pipe", "pipe", "pipe"] });
      dotnetBridge.current.process = proc;
      dotnetBridge.current._isRunning = true;

      proc.stdout?.on("data", (data) => {
        dotnetBridge.current.buffer += data.toString("utf-8");
        dotnetBridge.current.processBuffer();
      });

      proc.stderr?.on("data", (data) => {
        console.error("[.NET Bridge]", data.toString("utf-8"));
      });

      proc.on("close", (code) => {
        console.log("[.NET Bridge] Exited with code", code);
        dotnetBridge.current._isRunning = false;
        dotnetBridge.current.process = null;
        for (const [id, call] of dotnetBridge.current.pending) {
          clearTimeout(call.timer);
          call.reject(new Error(".NET bridge disconnected"));
          dotnetBridge.current.pending.delete(id);
        }
        if (!dotnetBridge.current._stopping) {
          dotnetBridge.current.restartTimer = setTimeout(() => dotnetBridge.current.start(), 2000);
        }
      });

      proc.on("error", (err) => {
        console.error("[.NET Bridge] Failed to start:", err.message);
        dotnetBridge.current._isRunning = false;
        dotnetBridge.current.process = null;
      });
    };

    dotnetBridge.current.start();
    console.log("[.NET Bridge] Started successfully");
    return true;
  } catch (err) {
    console.warn("[.NET Bridge] Init failed:", err.message);
    return false;
  }
}

// ---- Python Bridge (????) ----
function startPythonBridge(isDev, pythonBridge) {
  const bridgePath = isDev
    ? path.join(__dirname, "..", "bridge", "server.py")
    : path.join(process.resourcesPath, "bridge", "server.py");
  if (!fs.existsSync(bridgePath)) {
    console.warn("[Python Bridge] server.py not found - no bridge available");
    return false;
  }
  try {
    pythonBridge.current = new PythonBridge(bridgePath);
    pythonBridge.current.start();
    console.log("[Python Bridge] Started successfully");
    return true;
  } catch (err) {
    console.warn("[Python Bridge] Init failed:", err.message);
    return false;
  }
}

function startPythonBridgeWithRetry(isDev, pythonBridge, maxRetries, delayMs) {
  let attempts = 0;
  let timer = null;

  function tryStart() {
    attempts++;
    console.log(`[Python Bridge] Attempt ${attempts}/${maxRetries}...`);

    if (startPythonBridge(isDev, pythonBridge)) {
      console.log(`[Python Bridge] Started on attempt ${attempts}`);
      return;
    }
    if (attempts < maxRetries) {
      console.warn(`[Python Bridge] Attempt ${attempts} failed, retrying in ${delayMs}ms...`);
      timer = setTimeout(tryStart, delayMs);
    } else {
      console.error(`[Python Bridge] All ${maxRetries} attempts failed - running without bridge`);
    }
  }

  tryStart();

  // Return a cancel function for cleanup
  return () => { if (timer) clearTimeout(timer); };
}

// ---- Setup: ???? ----
function setupBridges({ isDev, dotnetBridge, pythonBridge, app }) {
  const dotnetOk = startDotNetBridge(isDev, dotnetBridge);

  if (!dotnetOk) {
    // .NET ??? ? ?? 3 ???? Python ????? 3 ???
    console.log("[Bridge] .NET bridge unavailable, falling back to Python in 3s...");
    setTimeout(() => {
      startPythonBridgeWithRetry(isDev, pythonBridge, 3, 3000);
    }, 3000);
  }

  app.on("before-quit", () => {
    dotnetBridge.current?.stop();
    pythonBridge.current?.stop();
  });
}

module.exports = { setupBridges };
