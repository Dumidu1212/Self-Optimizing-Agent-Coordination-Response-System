/**
 * Contracts for Planner/Router (S002).
 * These interfaces keep routing testable and swappable (DIP).
 */
import type { Tool } from '../registry/model';

export type JsonRecord = Record<string, unknown>;

/** Request context for planning. */
export interface PlanContext {
  /** If known, the capability name (e.g., "patient.search"). */
  capability?: string;
  /** Optional free text; reserved for future intent mapping. */
  text?: string;
  /** Structured input to pass to the selected tool. */
  input?: JsonRecord;
  /** Optional tenant/user/request metadata. */
  context?: JsonRecord;
  /** Optional overall timeout for plan+exec (ms). */
  timeout_ms?: number;
  /** If true (default), execute the plan; otherwise return decision only. */
  execute?: boolean;
}

/** Candidate scored by the planner. */
export interface ScoredCandidate {
  toolId: string;
  score: number;
}

/** Outcome of execution (when execute=true). */
export interface ExecutionResult {
  status: 'success' | 'failure' | 'timeout';
  latency_ms?: number;
  error?: string;
  output?: JsonRecord;
}

/** Plan response. */
export interface PlanResult {
  traceId: string;
  capability: string;
  candidates: ScoredCandidate[];
  selected?: { toolId: string };
  execution?: ExecutionResult;
}

/** Strategy that assigns a scalar score to a tool given a context. */
export interface IScorer {
  score(tool: Tool, ctx: Required<Pick<PlanContext, 'capability' | 'input'>>): number;
}

/** Executes a tool with the given input and deadlines. */
export interface IToolExecutor {
  execute(
    tool: Tool,
    input: JsonRecord,
    overallAbort: AbortSignal
  ): Promise<ExecutionResult>;
}

/** Planner orchestrates candidate generation, scoring, selection, and fallback. */
export interface IPlanner {
  plan(ctx: PlanContext): Promise<PlanResult>;
}
