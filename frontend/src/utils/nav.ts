export function scrollTo(id: string, opts?: ScrollIntoViewOptions) {
    const el = document.getElementById(id);
    if (!el) return;

    // 1) Update URL hash without triggering the browser's instant jump
    const url = new URL(window.location.href);
    url.hash = id;
    history.pushState({}, "", url);   // or replaceState(...) if you don't want a new history entry

    // 2) Optional: make the section focusable for a11y and set focus (no scroll jump)
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });

    // 3) Smooth scroll
    el.scrollIntoView({ behavior: "smooth", block: "start", ...opts });
}
