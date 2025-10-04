import type { RunConfig, RunResponse, UploadedAlgorithm } from '@/types'

// Hinweis:
// Keine harte BASE-URL mehr! Wir rufen relativ zur aktuell geladenen Seite auf.
// Das funktioniert lokal (127.0.0.1:5050) und über ngrok identisch.
const API_BASE = ''; // same-origin

async function request<T>(path: string, init?: RequestInit, timeoutMs = 30000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_BASE}${path}`, { ...init, signal: controller.signal });

    // Text erst lesen, dann ggf. als JSON parsen (robuster bei Fehlern)
    const raw = await res.text();
    const isJSON = res.headers.get('content-type')?.includes('application/json');
    const data = isJSON && raw ? JSON.parse(raw) : (raw as unknown as T);

    if (!res.ok) {
      const msg =
        (isJSON && (data as any)?.error) ||
        (isJSON && (data as any)?.message) ||
        raw ||
        `HTTP ${res.status}`;
      throw new Error(msg);
    }

    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function uploadAlgorithm(
  file: File,
  meta: { name: string; language: 'python'; entry: string; sha256: string }
): Promise<UploadedAlgorithm> {
  const form = new FormData();
  form.append('file', file, file.name);
  form.append('meta', JSON.stringify(meta));

  const res = await fetch('/api/algorithms', { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  return res.json();
}

// GET /api/algorithms  -> UploadedAlgorithm[]
export async function listAlgorithms(): Promise<UploadedAlgorithm[]> {
  const res = await fetch('/api/algorithms');
  if (!res.ok) throw new Error(`List failed (${res.status})`);
  return res.json();
}

export async function runExperiment(cfg: RunConfig): Promise<RunResponse> {
  return request<RunResponse>('/api/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cfg),
  });
}
