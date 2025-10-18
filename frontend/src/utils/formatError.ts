// src/utils/formatError.ts
import { ApiError } from "@/api/http";
import i18n from "@/i18n"; // <-- import your initialized i18n instance

/**
 * Map a pydantic-like `loc` (string or string[]) to a readable, translated label.
 * Examples:
 *   "n_actions" -> t('fields.n_actions')
 *   ["body","env","type"] -> "body → env → type" (fallback)
 */
function labelFor(loc: unknown): string {
    const path = (Array.isArray(loc) ? loc : [loc]).filter(Boolean).map(String);
    const key = path[0] ?? "";

    // Try translated field label; fall back to the raw path joined with arrows, else "Field"
    const translated = key ? i18n.t(`fields.${key}`) : "";
    const joinedPath = path.length ? path.join(" → ") : "Field";
    return translated && translated !== `fields.${key}` ? translated : joinedPath;
}

/**
 * Convert diverse error shapes into short, helpful messages for toasts/UI.
 * Uses translations from errors.* (selectAtLeastOne, integer, ge, le, server, notFound, requestFailed, invalidPayload)
 */
export function formatError(err: unknown): string {
    if (err instanceof ApiError) {
        const b: any = err.json;

        // Pydantic-like: { detail: [{loc, msg, type, ctx?}, ...] }
        if (b?.detail && Array.isArray(b.detail) && b.detail.length) {
            const lines = b.detail.map((d: any) => {
                const where = labelFor(d?.loc);
                const serverMsg: string = d?.msg || "is invalid";

                // Common rewrites (translated)
                if (d?.type === "value_error.list.min_items" || /min items/i.test(serverMsg)) {
                    return `${where}: ${i18n.t("errors.selectAtLeastOne")}`;
                }
                if (d?.type === "type_error.integer" || /valid integer/i.test(serverMsg)) {
                    return `${where}: ${i18n.t("errors.integer")}`;
                }
                if (d?.type === "value_error.number.not_ge" && d?.ctx?.limit_value != null) {
                    return `${where}: ${i18n.t("errors.ge", { limit: d.ctx.limit_value })}`;
                }
                if (d?.type === "value_error.number.not_le" && d?.ctx?.limit_value != null) {
                    return `${where}: ${i18n.t("errors.le", { limit: d.ctx.limit_value })}`;
                }

                // Fallback: keep server message but keep it readable
                return `${where}: ${serverMsg}.`;
            });

            // Use bullets when rendering multiline text
            return `${lines.join("\n• ")}`;
        }

        // String-only bodies from server
        if (typeof err.raw === "string" && err.raw.trim()) return err.raw.trim();

        // Status-based fallbacks (translated)
        if (err.status >= 500) return i18n.t("errors.server");
        if (err.status === 404) return i18n.t("errors.notFound");
        if (err.status === 400) return i18n.t("errors.invalidPayload");
        return i18n.t("errors.requestFailed", { status: err.status });
    }

    // Fallback for plain Errors / unknowns
    return (err as any)?.message ?? String(err ?? "Unknown error");
}
