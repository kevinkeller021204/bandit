// src/Header.tsx
import { useEffect, useState, useRef } from "react";
import Scrollspy from "react-scrollspy";
import { useTranslation } from "react-i18next";

/**
* Header
* ------
* Sticky, responsive site header with:
* - Brand / subtitle
* - Two-section navigation (Selection / Results) using scrollspy
* - Mobile-optimized chip nav
* - Language toggle button
*
* Accessibility & UX
* - Uses <nav aria-label="Primary"> for main navigation landmarks.
* - Links advertise their active state via aria-current="page".
* - Header adds a subtle shadow and solid background once the page is scrolled
* (improves contrast over content).
*/

type HeaderProps = {
    selectionId: string;
    resultsId: string;
    onTranslate?: () => void;
};

export default function Header({
    selectionId,
    resultsId,
    onTranslate,
}: HeaderProps) {
    // Whether the window has scrolled enough to switch header style
    const { t, i18n } = useTranslation();
    const [scrolled, setScrolled] = useState(false);
    // Tracks which section is active (from Scrollspy)
    const [active, setActive] = useState<string>(selectionId);
    const [openLang, setOpenLang] = useState(false);
    const langBtnRef = useRef<HTMLButtonElement | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);

    // Close language menu when clicking outside or pressing ESC
    useEffect(() => {
        if (!openLang) return;
        const onDocClick = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                menuRef.current &&
                !menuRef.current.contains(target) &&
                langBtnRef.current &&
                !langBtnRef.current.contains(target)
            ) {
                setOpenLang(false);
            }
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpenLang(false);
        };
        document.addEventListener("mousedown", onDocClick);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDocClick);
            document.removeEventListener("keydown", onKey);
        };
    }, [openLang]);

    const setLang = (lng: "en" | "de") => {
        i18n.changeLanguage(lng);
        localStorage.setItem("lang", lng);
        setOpenLang(false);
        // still call external handler if someone passed one
        onTranslate?.();
    };

    const currentLang = (i18n.resolvedLanguage || i18n.language || "en").slice(0, 2).toLowerCase();

    // Listen for scroll to toggle condensed background/shadow
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 4);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    // Tailwind class presets for tabs
    const baseTab =
        "inline-flex items-center h-9 px-3 rounded-xl text-sm font-medium transition " +
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60";
    const inactiveTab =
        "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/70";
    const activeTab =
        "text-zinc-900 bg-white shadow-sm ring-1 ring-zinc-200";

    return (
        <header
            className={[
                "sticky top-0 z-20 border-b border-zinc-200/60 backdrop-blur supports-[backdrop-filter]:bg-white/60",
                scrolled ? "bg-white/70 shadow-[0_1px_0_0_rgba(0,0,0,0.02)]" : "bg-white/40",
            ].join(" ")}
            role="banner"
        >
            <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
                {/* Brand */}
                <div className="flex items-center gap-2">
                    <div className="text-base sm:text-lg font-semibold tracking-tight">
                        SliceWise <span className="ml-0.5">🍕</span>
                        <span className="sr-only"> — </span>
                        <span className="hidden sm:inline text-zinc-500 font-normal">
                            &nbsp; - {t("tagline", { defaultValue: "Bandit Lab" })}
                        </span>
                    </div>
                </div>

                {/* Nav */}
                <nav
                    className="flex items-center gap-2"
                    aria-label="Primary"
                >
                    {/* Desktop tabs: tracked by Scrollspy */}
                    <Scrollspy
                        items={[selectionId, resultsId]}
                        currentClassName="is-active"
                        onUpdate={(el) => el && setActive(el.id)}
                        offset={-72}
                        componentTag="ul"
                        className="hidden sm:flex items-center gap-2 rounded-xl bg-zinc-100/60 p-1 ring-1 ring-inset ring-zinc-200/60"
                    >
                        <li className="list-none">
                            <a
                                href={`#${selectionId}`}
                                className={[baseTab, active === selectionId ? activeTab : inactiveTab].join(" ")}
                                aria-current={active === selectionId ? "page" : undefined}
                            >
                                {t("nav.selection")}
                            </a>
                        </li>
                        <li className="list-none">
                            <a
                                href={`#${resultsId}`}
                                className={[baseTab, active === resultsId ? activeTab : inactiveTab].join(" ")}
                                aria-current={active === resultsId ? "page" : undefined}
                            >
                                {t("nav.results")}
                            </a>
                        </li>
                    </Scrollspy>

                    {/* Mobile chips: compact replacements for tabs */}
                    <div className="sm:hidden flex items-center gap-1">
                        <a
                            href={`#${selectionId}`}
                            className={[
                                "px-2 py-1 rounded-lg text-sm",
                                active === selectionId ? "bg-zinc-900 text-white" : "text-zinc-700 bg-zinc-100",
                            ].join(" ")}
                            aria-current={active === selectionId ? "page" : undefined}
                        >
                            {t("nav.selection")}
                        </a>
                        <a
                            href={`#${resultsId}`}
                            className={[
                                "px-2 py-1 rounded-lg text-sm",
                                active === resultsId ? "bg-zinc-900 text-white" : "text-zinc-700 bg-zinc-100",
                            ].join(" ")}
                            aria-current={active === resultsId ? "page" : undefined}
                        >
                            {t("nav.results")}
                        </a>
                    </div>

                    {/* Translate button */}
                    <div className="relative">
                        <button
                            ref={langBtnRef}
                            type="button"
                            title={t("nav.language")}
                            aria-label={t("nav.language")}
                            aria-haspopup="menu"
                            aria-expanded={openLang}
                            onClick={() => setOpenLang(o => !o)}
                            className="ml-1 inline-flex h-9 items-center gap-1 rounded-full border border-zinc-300 px-3 hover:bg-zinc-100 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60"
                        >
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                className="h-4 w-4"
                                strokeWidth={1.8}
                                aria-hidden="true"
                            >
                                <circle cx="12" cy="12" r="10" />
                                <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
                            </svg>
                            <span className="text-sm font-medium uppercase">{currentLang}</span>
                            <svg className="h-3.5 w-3.5 opacity-70" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.215l3.71-3.985a.75.75 0 111.08 1.04l-4.24 4.55a.75.75 0 01-1.08 0l-4.24-4.55a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                            </svg>
                        </button>

                        {openLang && (
                            <div
                                ref={menuRef}
                                role="menu"
                                aria-label={t("nav.language")}
                                className="absolute right-0 mt-2 w-44 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg"
                            >
                                <button
                                    role="menuitem"
                                    className={`flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-zinc-50 ${currentLang === "en" ? "font-semibold" : ""}`}
                                    onClick={() => setLang("en")}
                                >
                                    English
                                    {currentLang === "en" && <span aria-hidden>✓</span>}
                                </button>
                                <button
                                    role="menuitem"
                                    className={`flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-zinc-50 ${currentLang === "de" ? "font-semibold" : ""}`}
                                    onClick={() => setLang("de")}
                                >
                                    Deutsch
                                    {currentLang === "de" && <span aria-hidden>✓</span>}
                                </button>
                            </div>
                        )}
                    </div>
                </nav>
            </div>
        </header>
    );
}
