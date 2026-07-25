const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const KEY_PATH = "HKLM\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl";
const VALUE_NAME = "Win32PrioritySeparation";
const BACKUP_DIR = "C:\\CodeXaStudio\\backups";

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

module.exports = { readValue, writeValue, backupValue, BACKUP_DIR };
