// src/api/http.ts

/**
* API base path. Empty string means "same-origin" relative requests.
* Keep it blank for environments where the UI is reverse-proxied to the API.
*/
const API_BASE = '';

/**
* ApiError
* --------
* Normalized error wrapper for failed fetches with helpful fields.
* - `status` : HTTP status code
* - `url` : full request URL
* - `raw` : response body as text (always captured)
* - `json` : parsed JSON (if content-type was JSON & parse succeeded)
*
* The message prioritizes JSON `{error|message}` or falls back to raw/text.
*/
export class ApiError extends Error {
    status: number;
    url: string;
    raw: string;
    json?: unknown;
    constructor(opts: { status: number; url: string; raw: string; json?: unknown; message?: string }) {
        super(opts.message ?? (typeof opts.json === "string" ? opts.json : "Request failed"));
        this.name = "ApiError";
        this.status = opts.status;
        this.url = opts.url;
        this.raw = opts.raw;
        this.json = opts.json;
    }
}

/**
* request<T>
* ----------
* Fetch helper with:
* - AbortController timeout (default 30s)
* - Robust body handling (always reads text, optionally parses JSON)
* - Consistent ApiError on non-2xx responses
*
* Returns parsed JSON when available; otherwise returns the raw text (typed as T).
*/
export async function request<T>(path: string, init?: RequestInit, timeoutMs = 30000): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const url = `${API_BASE}${path}`;

    try {
        const res = await fetch(url, { ...init, signal: controller.signal });

        // Read text first (robust on errors), then optionally parse JSON
        const raw = await res.text();
        const isJSON = res.headers.get("content-type")?.includes("application/json");
        let parsed: unknown = undefined;
        if (isJSON && raw) {
            try { parsed = JSON.parse(raw); } catch { /* keep parsed undefined on bad JSON */ }
        }

        if (!res.ok) {
            const msg =
                (parsed as any)?.error ||
                (parsed as any)?.message ||
                raw ||
                `HTTP ${res.status}`;
            throw new ApiError({ status: res.status, url, raw, json: parsed, message: msg });
        }

        // Success path: return parsed JSON if we have it; otherwise cast text to T
        return (parsed !== undefined ? (parsed as T) : (raw as unknown as T));
    } finally {
        clearTimeout(timer);
    }
}