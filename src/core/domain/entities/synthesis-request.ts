/**
 * Synthesis Request Entity
 * 합성 요청을 나타내는 도메인 엔티티
 */

export type SynthesisType = 'framework' | 'summary' | 'comparison' | 'timeline';

export interface SynthesisOptions {
  /** 원본 노트로의 역링크 포함 여부 */
  includeBacklinks: boolean;
  /** AI가 태그 제안 여부 */
  autoSuggestTags: boolean;
  /** 생성될 노트의 언어 */
  language: 'ko' | 'en';
}

export interface SynthesisRequest {
  /** 고유 ID */
  id: string;
  /** 합성할 노트들의 ID 목록 */
  sourceNoteIds: string[];
  /** 생성될 노트 제목 (선택) */
  targetTitle?: string;
  /** 합성 타입 */
  synthesisType: SynthesisType;
  /** 합성 옵션 */
  options: SynthesisOptions;
  /** 요청 생성 시간 */
  createdAt: Date;
}

export const DEFAULT_SYNTHESIS_OPTIONS: SynthesisOptions = {
  includeBacklinks: true,
  autoSuggestTags: true,
  language: 'ko',
};

export function createSynthesisRequest(
  sourceNoteIds: string[],
  synthesisType: SynthesisType = 'framework',
  options: Partial<SynthesisOptions> = {}
): SynthesisRequest {
  return {
    id: generateId(),
    sourceNoteIds,
    synthesisType,
    options: { ...DEFAULT_SYNTHESIS_OPTIONS, ...options },
    createdAt: new Date(),
  };
}

function generateId(): string {
  return `syn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
