import type { RunConfig, RunResponse } from '@/types'
//input your ngrok link here, will make a bp that does that automatically
const BASE = 'http://localhost:5050'

export async function runExperiment(cfg: RunConfig): Promise<RunResponse> {
  const res = await fetch(`${BASE}/api/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cfg),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(t || 'Request failed')
  }
  return res.json()
}
