import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { Language } from "@/types";
import { STORAGE_LANG } from "@/constants/storage-keys";
interface LanguageContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: "zh",
  setLang: () => {},
});

export function useLanguage() {
  return useContext(LanguageContext);
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    return (localStorage.getItem(STORAGE_LANG) as Language) || "zh";
  });

  const setLang = useCallback((l: Language) => {
    setLangState(l);
    localStorage.setItem(STORAGE_LANG, l);
    window.electronAPI?.python.call("config.set", { language: l });
  }, []);

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}
