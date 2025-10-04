export type EnvType = 'bernoulli' | 'gaussian'

export interface RunConfig {
  env: EnvType
  n_actions: number
  iterations: number
  algorithms: string[]
  custom_algorithms?: string[]
  seed?: number
}

export interface RunResponse {
  env: any
  iterations: number
  traces: Record<string, { actions: number[]; rewards: number[] }>
  summary: Record<string, { mean_reward: number; final_avg_reward: number }>
}

export type UploadedAlgorithm = {
  id: string;           // returned by backend
  name: string;         // display name
  language: 'python';   // for now
  entry: string;        // entry function
  sha256?: string;      // optional echo-back
};