/**
 * Plugin Settings
 * 플러그인 설정 인터페이스
 */

import type { LLMProvider } from '../adapters/llm/llm-synthesis-generator';

export interface KnowledgeSynthesizerSettings {
  /** OpenAI API 키 */
  openaiApiKey: string;
  /** Anthropic API 키 */
  anthropicApiKey: string;
  /** 사용할 LLM 프로바이더 */
  llmProvider: LLMProvider;
  /** 사용할 모델 (선택) */
  model?: string;
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
  openaiApiKey: '',
  anthropicApiKey: '',
  llmProvider: 'openai',
  model: undefined,
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
