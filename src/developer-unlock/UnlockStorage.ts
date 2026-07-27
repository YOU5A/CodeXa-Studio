import { STORAGE_DEVELOPER_MODE } from "@/constants/storage-keys";

export class UnlockStorage {
  /** 读取解锁状态: localStorage 优先, Bridge 兜底 */
  static async getDeveloperMode(): Promise<boolean> {
    const local = localStorage.getItem(STORAGE_DEVELOPER_MODE);
    if (local !== null) return local === "true";

    try {
      if (window.electronAPI?.settings) {
        const bridgeValue = await window.electronAPI.settings.get("developerMode");
        if (typeof bridgeValue === "boolean") {
          localStorage.setItem(STORAGE_DEVELOPER_MODE, String(bridgeValue));
          return bridgeValue;
        }
      }
    } catch {
      // Bridge 不可用时忽略
    }

    return false;
  }

  /** 写入解锁状态: localStorage + Bridge */
  static async setDeveloperMode(value: boolean): Promise<void> {
    localStorage.setItem(STORAGE_DEVELOPER_MODE, String(value));

    try {
      if (window.electronAPI?.settings) {
        await window.electronAPI.settings.set("developerMode", value);
      }
    } catch {
      // Bridge 不可用时静默失败
    }
  }
}