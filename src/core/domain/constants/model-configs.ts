/**
 * Model Configurations — thin re-export from obsidian-llm-shared
 *
 * All model data, provider configs, and helper functions are maintained in
 * the shared package (single source of truth). This file re-exports them
 * so existing imports throughout the plugin continue to work unchanged.
 */
export type { AIProviderType, AIProviderConfig, ModelConfig } from 'obsidian-llm-shared';

export {
  AI_PROVIDERS,
  MODEL_CONFIGS,
  getModelsByProvider,
  getModelConfig,
  getProviderConfig,
  // New helpers this plugin was previously missing
  isReasoningModel,
  getEffectiveMaxTokens,
  getThinkingConfig,
  calculateCost,
} from 'obsidian-llm-shared';
