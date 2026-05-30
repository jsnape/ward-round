/**
 * @ward-round/contract — the versioned business-event schema, translator, and
 * (in §9) sinks + save format. The published, cross-language boundary.
 *
 * The schema is authored in TypeSpec (schema/main.tsp); the `*Json` types are
 * generated from it (generated/businessEvents.ts). Do not break the contract
 * without bumping SCHEMA_VERSION.
 */
export const CONTRACT_VERSION = "0.0.0";

export { SCHEMA_VERSION } from "./version.js";
export {
    type BusinessEventSink,
    type Translator,
    type TranslatorConfig,
    type TranslatorDeps,
    createTranslator,
} from "./translator.js";

// The generated contract types (TypeSpec → JSON Schema → TS). The union is
// re-exported under a clean name; the individual `*Json` types remain available.
export type { BusinessEventJson as BusinessEvent } from "../generated/businessEvents.js";
export type * from "../generated/businessEvents.js";
