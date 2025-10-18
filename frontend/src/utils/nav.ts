// src/utils/nav.ts
/**
* Smoothly scroll to an element by id, update the URL hash, and set focus for a11y.
*
* Behavior
* 1) Updates the URL hash via history.pushState to avoid the browser's instant jump.
* 2) Ensures the target is focusable and moves focus without scrolling (for screen readers/skip links).
* 3) Performs a smooth scroll into view.
*/
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
