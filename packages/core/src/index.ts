export * from "./types";
export * from "./result";
export { createModel } from "./model";
export { appearanceKey, transformingMode, type TransformingMode } from "./helpers";
export { loadModel, saveModel, type LoadError } from "./serialization";
export {
  addThing, removeThing, updateThing,
  addState, removeState, updateState,
  addLink, removeLink, updateLink,
  addOPD, removeOPD, updateOPD, refineThing,
  addAppearance, removeAppearance, updateAppearance,
  addModifier, removeModifier, updateModifier,
  addFan, removeFan, updateFan,
  addScenario, removeScenario, updateScenario,
  addAssertion, removeAssertion, updateAssertion,
  addRequirement, removeRequirement, updateRequirement,
  addStereotype, removeStereotype, updateStereotype,
  addSubModel, removeSubModel, updateSubModel,
  updateMeta, updateSettings,
  validate,
  bringConnectedThings,
  findConsumptionResultPairs,
  findStructuralForks,
  getSemiFoldedParts,
  type ConsumptionResultPair,
  type StructuralFork,
  type SemiFoldEntry,
} from "./api";
export {
  type History,
  createHistory, pushHistory, undo, redo,
} from "./history";
export {
  expose, applyOplEdit, render, renderAll, modelStats, oplSlug, editsFrom,
} from "./opl";
export type {
  OplSentence, OplThingDeclaration, OplStateEnumeration, OplDuration,
  OplLinkSentence, OplModifierSentence, OplDocument, OplEdit, OplRenderSettings,
  OplStateDescription, OplGroupedStructuralSentence, OplInZoomSequence, OplAttributeValue,
  OplFanSentence,
} from "./opl-types";
export type { ModelStats } from "./opl";
export { verifyMethodology, type CheckResult } from "./methodology";
export { exportMarkdown } from "./export-md";
export {
  createInitialState,
  evaluatePrecondition,
  simulationStep,
  runSimulation,
  runMonteCarloSimulation,
  renderTrace,
  type MonteCarloResult,
  type AssertionResult,
  chooseFanBranch,
  getPreprocessSet,
  getPostprocessSet,
  getExecutableProcesses,
  resolveLinksForOpd,
  resolveOpdFiber,
  type ModelState,
  type FiberEntry,
  type OpdFiber,
  type ObjectState,
  type SimulationEvent,
  type SimulationStep,
  type SimulationTrace,
  type PreconditionResult,
  type ExecutableProcess,
  type ResolvedLink,
} from "./simulation";
export {
  STRUCTURAL_TYPES,
  structuralParentEnd,
  getStructuralChildren,
  getStructuralParent,
  getInheritedLinks,
} from "./structural";
