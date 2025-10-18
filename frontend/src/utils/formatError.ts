// // src/utils/formatError.ts
import { ApiError } from "@/api/http";

const LABELS: Record<string, string> = {
    env: "Bandit",
    n_actions: "Toppings",
    iterations: "Customers",
    algorithms: "Algorithms",
    custom_algorithms: "Custom algorithms",
    seed: "Random seed",
    session_id: "Session",
};

function labelFor(loc: unknown): string {
    const path = Array.isArray(loc) ? loc : [loc];
    const key = String(path[0] ?? "");
    return LABELS[key] || (path.filter(Boolean).map(String).join(" → ") || "Field");
}

export function formatError(err: unknown): string {
    if (err instanceof ApiError) {
        const b: any = err.json;

        // Pydantic-like: { error, detail: [{loc, msg, type, ctx?}, ...] }
        if (b?.detail && Array.isArray(b.detail) && b.detail.length) {
            const lines = b.detail.map((d: any) => {
                const where = labelFor(d?.loc);
                const msg: string = d?.msg || "is invalid";

                // common rewrites
                if (d?.type === "value_error.list.min_items" || /min items/i.test(msg)) {
                    return `${where}: please select at least one option.`;
                }
                if (d?.type === "type_error.integer" || /valid integer/i.test(msg)) {
                    return `${where}: enter a whole number.`;
                }
                if (d?.type === "value_error.number.not_ge" && d?.ctx?.limit_value != null) {
                    return `${where}: must be ≥ ${d.ctx.limit_value}.`;
                }
                if (d?.type === "value_error.number.not_le" && d?.ctx?.limit_value != null) {
                    return `${where}: must be ≤ ${d.ctx.limit_value}.`;
                }
                return `${where}: ${msg}.`;
            });

            return `${lines.join("\n• ")}`;
        }

        // string-only bodies
        if (typeof err.raw === "string" && err.raw.trim()) return err.raw.trim();

        // status-based fallback
        if (err.status >= 500) return "Server error. Please try again in a moment.";
        if (err.status === 404) return "Not found. Please refresh and try again.";
        if (err.status === 400) return "Your input looks invalid. Please review the fields.";
        return `Request failed (${err.status}).`;
    }

    // Fallback for plain Errors / unknowns
    return (err as any)?.message ?? String(err ?? "Unknown error");
}
