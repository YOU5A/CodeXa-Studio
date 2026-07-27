import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { devUnlockService } from "./DeveloperUnlockService";

interface DevUnlockContextValue {
  isDeveloperMode: boolean;
  isGameOpen: boolean;
  clickCount: number;
  remainingClicks: number;
  registerVersionClick: () => { remaining: number; triggered: boolean };
  openGame: () => void;
  closeGame: () => void;
  unlock: () => Promise<void>;
  lock: () => Promise<void>;
}

const DevUnlockContext = createContext<DevUnlockContextValue>({
  isDeveloperMode: false,
  isGameOpen: false,
  clickCount: 0,
  remainingClicks: 10,
  registerVersionClick: () => ({ remaining: 10, triggered: false }),
  openGame: () => {},
  closeGame: () => {},
  unlock: async () => {},
  lock: async () => {},
});

export function useDevUnlock() {
  return useContext(DevUnlockContext);
}

const MAX_CLICKS = 10;

export function DevUnlockProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState({
    isDeveloperMode: devUnlockService.isDeveloperMode,
    isGameOpen: devUnlockService.isGameOpen,
    clickCount: devUnlockService.clickCount,
  });

  useEffect(() => {
    devUnlockService.init();
    const unsubscribe = devUnlockService.subscribe(() => {
      setState({
        isDeveloperMode: devUnlockService.isDeveloperMode,
        isGameOpen: devUnlockService.isGameOpen,
        clickCount: devUnlockService.clickCount,
      });
    });
    return () => { unsubscribe(); };
  }, []);

  const remainingClicks = MAX_CLICKS - state.clickCount;

  const registerVersionClick = useCallback(() => {
    return devUnlockService.registerClick();
  }, []);

  const openGame = useCallback(() => {
    devUnlockService.openGame();
  }, []);

  const closeGame = useCallback(() => {
    devUnlockService.closeGame();
  }, []);

  const unlock = useCallback(async () => {
    await devUnlockService.unlock();
  }, []);

  const lock = useCallback(async () => {
    await devUnlockService.lock();
  }, []);

  return (
    <DevUnlockContext.Provider
      value={{
        isDeveloperMode: state.isDeveloperMode,
        isGameOpen: state.isGameOpen,
        clickCount: state.clickCount,
        remainingClicks,
        registerVersionClick,
        openGame,
        closeGame,
        unlock,
        lock,
      }}
    >
      {children}
    </DevUnlockContext.Provider>
  );
}