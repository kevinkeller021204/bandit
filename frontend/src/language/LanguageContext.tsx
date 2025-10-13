// src/LanguageContext.tsx
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DICT, LANG_NAMES, type Lang } from './i18n';

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<Ctx | null>(null);

const STORAGE_KEY = 'app.lang';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
    return saved && DICT[saved] ? saved : 'de';
  });

  function setLang(l: Lang) {
    setLangState(l);
    localStorage.setItem(STORAGE_KEY, l);
  }

  useEffect(() => {
    // html lang setzen
    document.documentElement.setAttribute('lang', lang);
  }, [lang]);

  const t = useMemo(() => {
    const table = DICT[lang] || {};
    return (key: string) => table[key] ?? key;
  }, [lang]);

  const value: Ctx = { lang, setLang, t };
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useI18n must be used within LanguageProvider');
  return ctx;
}

export { LANG_NAMES, type Lang };