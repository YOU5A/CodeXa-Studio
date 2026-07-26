import { useCallback } from "react";

const api = window.electronAPI;

export function useBridge() {
  const call = useCallback(async (method: string, params?: any) => {
    if (!api) {
      console.warn("[Bridge] Electron API not available");
      return { error: "Not running in Electron" };
    }
    try {
      const result = await api.python.call(method, params);
      return result;
    } catch (err: any) {
      return { error: err.message };
    }
  }, []);

  const openFolder = useCallback(async () => {
    if (!api) return null;
    return api.dialog.openFolder();
  }, []);

  const openFile = useCallback(async (filters?: any) => {
    if (!api) return null;
    return api.dialog.openFile(filters);
  }, []);

  const saveFile = useCallback(async (options?: any) => {
    if (!api) return null;
    return api.dialog.saveFile(options);
  }, []);

  return { call, openFolder, openFile, saveFile, isElectron: !!api };
}
