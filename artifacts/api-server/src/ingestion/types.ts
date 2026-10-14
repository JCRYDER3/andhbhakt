// The uniform connector interface — docs/jan-score-ideas.md idea #9.
// Every data-source connector returns this same shape and is registered in
// one place (orchestrator.ts), so adding a new source never has to touch
// the scoring engine, the review queue, or the UI.
export interface ConnectorResult {
  recordsProcessed: number;
  recordsFlagged: number;
  errors: string[];
}
