export { goldDocumentSchema, type GoldDocument, type GoldValue } from "./gold";
export { loadCorpus, type CorpusSplit } from "./corpus";
export { oracle, regexBaseline } from "./predictors";
export {
  scoreEvaluation,
  normalizeSalutation,
  type EvaluationCase,
  type EvaluationScore,
} from "./score";
