// src/LanguageDropdown.tsx
import { LANG_NAMES, type Lang } from './i18n';
import { useI18n } from './LanguageContext';

export default function LanguageDropdown() {
  const { lang, setLang } = useI18n();

  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="text-zinc-600">🌐</span>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        className="input"
        aria-label="Language"
      >
        {(Object.keys(LANG_NAMES) as Lang[]).map((l) => (
          <option key={l} value={l}>{LANG_NAMES[l]}</option>
        ))}
      </select>
    </label>
  );
}
