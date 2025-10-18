
// Hinweis:
// Keine harte BASE-URL mehr! Wir rufen relativ zur aktuell geladenen Seite auf.
// Das funktioniert lokal (127.0.0.1:5050) und über ngrok identisch.
const API_BASE = ''; // same-origin

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

export async function request<T>(path: string, init?: RequestInit, timeoutMs = 30000): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const url = `${API_BASE}${path}`;

    try {
        const res = await fetch(url, { ...init, signal: controller.signal });

        // read text first (robust on errors), then optionally parse JSON
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

        // success path: return parsed JSON if we have it; otherwise cast text to T
        return (parsed !== undefined ? (parsed as T) : (raw as unknown as T));
    } finally {
        clearTimeout(timer);
    }
}