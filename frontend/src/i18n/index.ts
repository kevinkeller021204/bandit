// src/i18n/index.ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// import your bundled translation files
import de from "./locales/de.json";
import en from "./locales/en.json";

export const defaultNS = "common";
export const supportedLngs = ["de", "en"] as const;

const resources = {
  de: { [defaultNS]: de },
  en: { [defaultNS]: en },
} as const;

void i18n
  .use(LanguageDetector)        // <— enables the `detection` options
  .use(initReactI18next)
  .init({
    resources,                  // <— provide translations
    fallbackLng: "de",
    supportedLngs: Array.from(supportedLngs),
    ns: [defaultNS],
    defaultNS,
    load: "currentOnly",
    interpolation: { escapeValue: false },
    detection: {
      order: ["querystring", "localStorage", "navigator"],
      caches: ["localStorage"],
    },
    react: { useSuspense: true },
  });

export default i18n;

// --- Optional: tighten TS types so t('...') is typed ---
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS;
    resources: (typeof resources)["de"];
  }
}
