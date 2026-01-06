/**
 * Plugin Settings
 * 플러그인 설정 인터페이스
 */

import { AIProviderType, AI_PROVIDERS } from '../core/domain/constants';

export interface AISettings {
  /** 현재 선택된 프로바이더 */
  provider: AIProviderType;
  /** 프로바이더별 API 키 */
  apiKeys: Partial<Record<AIProviderType, string>>;
  /** 프로바이더별 선택된 모델 */
  models: Record<AIProviderType, string>;
}

export interface KnowledgeSynthesizerSettings {
  /** AI 설정 */
  ai: AISettings;
  /** 합성 결과 저장 폴더 */
  outputFolder: string;
  /** 기본 합성 옵션 */
  defaultSynthesisOptions: {
    /** 역링크 포함 여부 */
    includeBacklinks: boolean;
    /** 자동 태그 제안 */
    autoSuggestTags: boolean;
    /** 기본 언어 */
    language: 'ko' | 'en';
  };
  /** 클러스터링 옵션 */
  clusterOptions: {
    /** 최소 클러스터 크기 */
    minClusterSize: number;
    /** 최소 응집도 */
    minCoherence: number;
    /** 최대 추천 수 */
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
