import { UnlockStorage } from "./UnlockStorage";

const MAX_CLICKS = 10;
const CLICK_RESET_MS = 10_000;

class DevUnlockServiceImpl {
  clickCount = 0;
  isGameOpen = false;
  isDeveloperMode = false;
  private listeners = new Set<() => void>();
  private clickTimer: ReturnType<typeof setTimeout> | null = null;

  /** 订阅状态变更 */
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    Promise.resolve().then(() => this.listeners.forEach((fn) => fn()));
  }

  /** 初始化: 从存储读取解锁状态 */
  async init() {
    this.isDeveloperMode = await UnlockStorage.getDeveloperMode();
    this.notify();
  }

  /** 注册版本号点击, 返回 { remaining, triggered } */
  registerClick(): { remaining: number; triggered: boolean } {
    if (this.isDeveloperMode) return { remaining: 0, triggered: false };
    if (this.isGameOpen) return { remaining: 0, triggered: false };

    this.clickCount++;
    this.notify();

    // Reset inactivity auto-reset timer
    this.resetClickTimer();

    const remaining = MAX_CLICKS - this.clickCount;
    if (this.clickCount >= MAX_CLICKS) {
      return { remaining: 0, triggered: true };
    }
    return { remaining, triggered: false };
  }

  /** 30 秒无操作自动清零 */
  private resetClickTimer() {
    if (this.clickTimer) clearTimeout(this.clickTimer);
    this.clickTimer = setTimeout(() => {
      this.clickCount = 0;
      this.clickTimer = null;
      this.notify();
    }, CLICK_RESET_MS);
  }

  /** 打开游戏 */
  openGame() {
    this.isGameOpen = true;
    this.notify();
  }

  /** 关闭游戏 (失败/超时/ESC) */
  closeGame() {
    this.isGameOpen = false;
    this.clickCount = 0;
    if (this.clickTimer) { clearTimeout(this.clickTimer); this.clickTimer = null; }
    this.notify();
  }

  /** 永久解锁 */
  async unlock() {
    this.isDeveloperMode = true;
    this.isGameOpen = false;
    if (this.clickTimer) { clearTimeout(this.clickTimer); this.clickTimer = null; }
    await UnlockStorage.setDeveloperMode(true);
    this.notify();
  }

  /** 重新锁定开发者模式 */
  async lock() {
    this.isDeveloperMode = false;
    this.clickCount = 0;
    if (this.clickTimer) { clearTimeout(this.clickTimer); this.clickTimer = null; }
    await UnlockStorage.setDeveloperMode(false);
    this.notify();
  }
}

/** 全局单例 */
export const devUnlockService = new DevUnlockServiceImpl();