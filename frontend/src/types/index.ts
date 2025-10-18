// ---------- Environment ----------
export type EnvType = 'bernoulli' | 'gaussian';

export interface BernoulliEnvInfo {
  type: 'bernoulli';
  n_actions: number;
  p: number[];
}

export interface GaussianEnvInfo {
  type: 'gaussian';
  n_actions: number;
  means: number[];
  stds: number[];
}

export type EnvInfo = BernoulliEnvInfo | GaussianEnvInfo;

// ---------- Run config / responses ----------
export interface RunConfig {
  env: EnvType;
  n_actions: number;
  iterations: number;
  algorithms: string[];
  custom_algorithms?: string[];
  seed?: number;
}

export interface PlayCtx {
  n_actions: number;
  algorithms: string[];
  custom_algorithms?: string[];
  seed?: number;
  data: PlayStartResponse
}

export type Trace = { actions: number[]; rewards: number[] };
export type Traces = Record<string, Trace>;

export interface RunResponse {
  env: EnvInfo;
  iterations: number;
  traces: Traces;
  summary: Record<string, { mean_reward: number; final_avg_reward: number }>;
}

// ---------- Uploads ----------
export type UploadedAlgorithm = {
  id: string;
  name: string;        // display name
  language: 'python';  // for now
  entry: string;       // entry function
  sha256?: string;     // optional echo-back
};

export type UploadAlgorithmMeta = {
  name: string;
  language: 'python';
  entry: string;
  sha256: string;
};

// ---------- Play ----------
export interface PlayStartRequest {
  env: EnvType;
  n_actions: number;
  iterations: number;
  algorithms: string[];
  seed?: number;
}

export interface PlayStartResponse {
  session_id: string;
  env: EnvInfo;
  t: number;
  iterations: number;
}

export interface PlayStepRequest {
  session_id: string;
  action: number;
}
export interface PlayStepResponse {
  t: number;
  action: number;
  reward: number;
  accepted?: boolean;
  done?: boolean;
}

export type PlayLogHistoryItem = {
  t: number;
  action: number;
  reward: number;
  accepted?: boolean;
};
export interface PlayLogResponse {
  t: number;
  iterations: number;
  history: PlayLogHistoryItem[];
  env: EnvInfo;
}

export interface PlayEndRequest { session_id: string }
export interface PlayEndResponse { ok: boolean }

export interface PlayResetRequest { session_id: string }
export interface PlayResetResponse { ok: boolean; t: number }

// ---------- Plot from session ----------
export interface PlotFromSessionRequest {
  session_id: string;
  algorithms: string[];
  custom_algorithms?: string[];
  iterations?: number;
}

// ---------- UI helpers (used in Results/ManualPlay) ----------
export type ManualEv = {
  t: number;
  action: number;
  reward: number;
  accepted?: boolean;
};
