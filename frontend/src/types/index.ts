export type EnvType = 'bernoulli' | 'gaussian'

export interface RunConfig {
  env: EnvType
  n_actions: number
  iterations: number
  algorithms: string[]
  seed?: number
}

export interface RunResponse {
  env: any
  iterations: number
  traces: Record<string, { actions: number[]; rewards: number[] }>
  summary: Record<string, { mean_reward: number; final_avg_reward: number }>
}
