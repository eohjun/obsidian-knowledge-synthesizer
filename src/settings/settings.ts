/**
 * Plugin Settings
 * Plugin settings interface
 */

import { AIProviderType, AI_PROVIDERS } from '../core/domain/constants';

export interface AISettings {
  /** Currently selected provider */
  provider: AIProviderType;
  /** API keys by provider */
  apiKeys: Partial<Record<AIProviderType, string>>;
  /** Selected model by provider */
  models: Record<AIProviderType, string>;
}

export interface KnowledgeSynthesizerSettings {
  /** AI settings */
  ai: AISettings;
  /** Folder to save synthesis results */
  outputFolder: string;
  /** Folders to exclude (Daily notes, Templates, etc.) */
  excludedFolders: string[];
  /** Default synthesis options */
  defaultSynthesisOptions: {
    /** Whether to include backlinks */
    includeBacklinks: boolean;
    /** Auto-suggest tags */
    autoSuggestTags: boolean;
    /** Default language */
    language: 'ko' | 'en';
  };
  /** Clustering options */
  clusterOptions: {
    /** Minimum cluster size */
    minClusterSize: number;
    /** Minimum coherence score */
    minCoherence: number;
    /** Maximum number of suggestions */
    maxSuggestions: number;
  };
}

export const DEFAULT_SETTINGS: KnowledgeSynthesizerSettings = {
  ai: {
    provider: 'openai',
    apiKeys: {},
    models: {
      claude: AI_PROVIDERS.claude.defaultModel,
      openai: AI_PROVIDERS.openai.defaultModel,
      gemini: AI_PROVIDERS.gemini.defaultModel,
      grok: AI_PROVIDERS.grok.defaultModel,
    },
  },
  outputFolder: 'Synthesized',
  excludedFolders: ['06_Meta'],
  defaultSynthesisOptions: {
    includeBacklinks: true,
    autoSuggestTags: true,
    language: 'ko',
  },
  clusterOptions: {
    minClusterSize: 3,
    minCoherence: 0.4,
    maxSuggestions: 5,
  },
};
