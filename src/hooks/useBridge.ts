import { useCallback } from "react";
import type { RpcMethod } from "@/types";

const api = window.electronAPI;

/** Generic bridge call wrapper. Returns Record<string, unknown> by default;
 *  callers can narrow with call<MyType>(...) when the shape is known. */
export function useBridge() {
  const call = useCallback(async <T extends Record<string, unknown> = Record<string, unknown>>(
    method: RpcMethod,
    params?: Record<string, unknown>
  ): Promise<T> => {
    if (!api) {
      console.warn("[Bridge] Electron API not available");
      return { error: "Not running in Electron" } as unknown as T;
    }
    try {
      const result = await api.bridge.call(method, params);
      return result as T;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: message } as unknown as T;
    }
  }, []);

  const openFolder = useCallback(async () => {
    if (!api) return null;
    return api.dialog.openFolder();
  }, []);

  const openFile = useCallback(async (filters?: { name: string; extensions: string[] }[]) => {
    if (!api) return null;
    return api.dialog.openFile(filters);
  }, []);

  const saveFile = useCallback(async (options?: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => {
    if (!api) return null;
    return api.dialog.saveFile(options);
  }, []);

  return { call, openFolder, openFile, saveFile, isElectron: !!api };
}
