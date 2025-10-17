// src/Header.tsx
import { useEffect, useState } from "react";
import Scrollspy from "react-scrollspy";

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
    const [scrolled, setScrolled] = useState(false);
    const [active, setActive] = useState<string>(selectionId);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 4);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

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
                            &nbsp; - Bandit-Labor
                        </span>
                    </div>
                </div>

                {/* Nav */}
                <nav
                    className="flex items-center gap-2"
                    aria-label="Primary"
                >
                    <Scrollspy
                        items={[selectionId, resultsId]}
                        currentClassName="is-active" // applied to the matching <li>
                        onUpdate={(el) => el && setActive(el.id)}
                        offset={-72}                 // helps when you have a sticky header
                        componentTag="ul"
                        className="hidden sm:flex items-center gap-2 rounded-2xl bg-zinc-100/60 p-1 ring-1 ring-inset ring-zinc-200/60"
                    >
                        <li className="list-none">
                            <a
                                href={`#${selectionId}`}
                                className={[baseTab, active === selectionId ? activeTab : inactiveTab].join(" ")}
                                aria-current={active === selectionId ? "page" : undefined}
                            >
                                Selection
                            </a>
                        </li>
                        <li className="list-none">
                            <a
                                href={`#${resultsId}`}
                                className={[baseTab, active === resultsId ? activeTab : inactiveTab].join(" ")}
                                aria-current={active === resultsId ? "page" : undefined}
                            >
                                Results
                            </a>
                        </li>
                    </Scrollspy>

                    {/* Mobile chips */}
                    <div className="sm:hidden flex items-center gap-1">
                        <a
                            href={`#${selectionId}`}
                            className={[
                                "px-2 py-1 rounded-lg text-sm",
                                active === selectionId ? "bg-zinc-900 text-white" : "text-zinc-700 bg-zinc-100",
                            ].join(" ")}
                            aria-current={active === selectionId ? "page" : undefined}
                        >
                            Sel.
                        </a>
                        <a
                            href={`#${resultsId}`}
                            className={[
                                "px-2 py-1 rounded-lg text-sm",
                                active === resultsId ? "bg-zinc-900 text-white" : "text-zinc-700 bg-zinc-100",
                            ].join(" ")}
                            aria-current={active === resultsId ? "page" : undefined}
                        >
                            Res.
                        </a>
                    </div>

                    {/* Translate button */}
                    <button
                        type="button"
                        title="Change language"
                        aria-label="Change language"
                        onClick={onTranslate}
                        className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 hover:bg-zinc-100 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60"
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
                    </button>
                </nav>
            </div>
        </header>
    );
}
