const { spawn } = require("child_process");

class RpcBridge {
  constructor() {
    this.process = null;
    this.pending = new Map();
    this.requestId = 0;
    this.buffer = "";
    this._isRunning = false;
    this.restartTimer = null;
    this._stopping = false;
    this.command = null;
    this.args = [];
  }

  get isRunning() {
    return this._isRunning;
  }

  start(command, args = []) {
    this.command = command;
    this.args = args;

    try {
      this.process = spawn(command, args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env },
      });

      this._isRunning = true;

      this.process.stdout?.on("data", (data) => {
        this.buffer += data.toString("utf-8");
        this.processBuffer();
      });

      this.process.stderr?.on("data", (data) => {
        console.error("[Rpc Bridge]", data.toString("utf-8"));
      });

      this.process.on("close", (code) => {
        console.log(`[Rpc Bridge] Exited with code ${code}`);
        this._isRunning = false;
        this.process = null;
        for (const [id, call] of this.pending) {
          clearTimeout(call.timer);
          call.reject(new Error("RPC bridge disconnected"));
          this.pending.delete(id);
        }
        if (!this._stopping && this.command) {
          this.restartTimer = setTimeout(() => this.start(this.command, this.args), 2000);
        }
      });

      this.process.on("error", (err) => {
        console.error("[Rpc Bridge] Failed to start:", err.message);
        this._isRunning = false;
        this.process = null;
      });
    } catch (err) {
      console.error("[Rpc Bridge] Spawn failed:", err.message);
      this._isRunning = false;
    }
  }

  stop() {
    this._stopping = true;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.process) {
      try {
        this.process.stdin.write(
          JSON.stringify({ method: "__shutdown__" }) + "\n"
        );
      } catch {}
      setTimeout(() => {
        if (this.process) {
          this.process.kill();
          this.process = null;
        }
      }, 1000);
    }
    this._isRunning = false;
  }

  call(method, params) {
    return new Promise((resolve, reject) => {
      if (!this.process || !this._isRunning) {
        reject(new Error("RPC bridge not running"));
        return;
      }

      const id = ++this.requestId;
      const request = JSON.stringify({ id, method, params: params || {} });

      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`RPC timeout: ${method}`));
      }, 30000);

      this.pending.set(id, { resolve, reject, timer });

      try {
        this.process.stdin.write(request + "\n");
      } catch (e) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(e);
      }
    });
  }

  processBuffer() {
    while (true) {
      const idx = this.buffer.indexOf("\n");
      if (idx === -1) break;

      const line = this.buffer.substring(0, idx).trim();
      this.buffer = this.buffer.substring(idx + 1);

      if (!line) continue;

      try {
        const response = JSON.parse(line);
        if (response.id && this.pending.has(response.id)) {
          const call = this.pending.get(response.id);
          clearTimeout(call.timer);
          this.pending.delete(response.id);

          if (response.error) {
            call.reject(new Error(response.error));
          } else {
            call.resolve(response.result);
          }
        }
      } catch {
        // skip invalid
      }
    }
  }
}

module.exports = { RpcBridge };
