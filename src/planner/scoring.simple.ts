/**
 * Simple Contract-Net style scorer.
 * score = w1*fit + w2*sla_likelihood + w3*past_reward_est - w4*cost_estimate
 * In v0.1: fit = 1 for exact capability, sla_likelihood derived from p95,
 * past_reward_est = 0.5 (neutral), cost_estimate normalized as-is.
 */
import type { IScorer, PlanContext } from './contracts';
import type { Tool } from '../registry/model';

/** Weights can be tuned by a future Policy Engine. */
const DEFAULT_WEIGHTS = {
  wFit: 0.45,
  wSla: 0.25,
  wReward: 0.15,
  wCost: 0.15
};

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function slaLikelihood(tool: Tool): number {
  const p95 = tool.sla?.p95_ms ?? 3000;
  // Map lower p95 to higher likelihood: 0ms->1, 5000ms->~0
  const lik = 1 - Math.min(p95, 5000) / 5000;
  return clamp01(lik);
}

function pastReward(tool: Tool): number {
  // Placeholder until memory/metrics added; treat all equally for now.
  void tool;
  return 0.5;
}

/** Fit is 1.0 if tool declares the requested capability. (We already filter by capability.) */
function capabilityFit(_tool: Tool, _ctx: Required<Pick<PlanContext, 'capability' | 'input'>>): number {
  return 1.0;
}

export class SimpleScorer implements IScorer {
  constructor(private readonly weights = DEFAULT_WEIGHTS) {}

  score(tool: Tool, ctx: Required<Pick<PlanContext, 'capability' | 'input'>>): number {
    const fit = capabilityFit(tool, ctx);
    const sla = slaLikelihood(tool);
    const reward = pastReward(tool);
    const cost = tool.cost_estimate ?? 0;

    const { wFit, wSla, wReward, wCost } = this.weights;
    // Higher is better; subtract cost component.
    const s = wFit * fit + wSla * sla + wReward * reward - wCost * cost;
    return Number.isFinite(s) ? s : -Infinity;
  }
}
