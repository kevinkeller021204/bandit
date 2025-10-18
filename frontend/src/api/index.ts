import type {
  PlayEndRequest, PlayEndResponse, PlayLogResponse, PlayResetRequest, PlayResetResponse, PlayStartRequest, PlayStartResponse,
  PlayStepResponse, PlotFromSessionRequest, RunResponse, UploadedAlgorithm
} from '@/types'
import { request } from './http';

export async function uploadAlgorithm(
  file: File,
  meta: { name: string; language: "python"; entry: string; sha256: string }
): Promise<UploadedAlgorithm> {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("meta", JSON.stringify(meta));

  try {
    // NOTE: do NOT set Content-Type for FormData; browser populates boundary.
    return await request<UploadedAlgorithm>("/api/algorithms", {
      method: "POST",
      body: form,
    });
  } catch (e) {
    throw e
  }
}

export async function listAlgorithms(): Promise<UploadedAlgorithm[]> {
  try {
    return await request<UploadedAlgorithm[]>("/api/algorithms");
  } catch (e) {
    throw e
  }
}

/* ---------------------------------- Play ----------------------------------- */

export async function playStart(cfg: PlayStartRequest): Promise<PlayStartResponse> {
  try {
    return await request<PlayStartResponse>("/api/play/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cfg),
    });
  } catch (e) {
    throw e
  }
}

export async function playStep(session_id: string, action: number): Promise<PlayStepResponse> {
  try {
    return await request<PlayStepResponse>("/api/play/step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id, action }),
    });
  } catch (e) {
    throw e
  }
}

export async function playLog(session_id: string): Promise<PlayLogResponse> {
  try {
    const q = new URLSearchParams({ session_id }).toString();
    return await request<PlayLogResponse>(`/api/play/log?${q}`);
  } catch (e) {
    throw e
  }
}

export async function playEnd(session_id: string): Promise<PlayEndResponse> {
  try {
    return await request<PlayEndResponse>("/api/play/end", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id } as PlayEndRequest),
    });
  } catch (e) {
    throw e
  }
}

export async function playReset(session_id: string): Promise<PlayResetResponse> {
  try {
    return await request<PlayResetResponse>("/api/play/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id } as PlayResetRequest),
    });
  } catch (e) {
    throw e
  }
}

/* --------------------------------- Plots ----------------------------------- */

export async function plotFromSession(payload: PlotFromSessionRequest): Promise<RunResponse> {
  try {
    return await request<RunResponse>("/api/plot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    throw e
  }
}