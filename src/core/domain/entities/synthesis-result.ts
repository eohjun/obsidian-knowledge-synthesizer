/**
 * Synthesis Result Entity
 * 합성 결과를 나타내는 도메인 엔티티
 */

import type { SynthesisType } from './synthesis-request';

export interface SynthesisResult {
  /** 고유 ID */
  id: string;
  /** 원본 요청 ID */
  requestId: string;
  /** 생성된 노트 제목 */
  title: string;
  /** 생성된 마크다운 콘텐츠 */
  content: string;
  /** 원본 노트 링크들 (wikilink 형식) */
  sourceNoteLinks: string[];
  /** AI가 제안한 태그들 */
  suggestedTags: string[];
  /** 합성 타입 */
  synthesisType: SynthesisType;
  /** 생성 시간 */
  createdAt: Date;
}

export function createSynthesisResult(
  requestId: string,
  title: string,
  content: string,
  sourceNoteLinks: string[],
  synthesisType: SynthesisType,
  suggestedTags: string[] = []
): SynthesisResult {
  return {
    id: `result_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    requestId,
    title,
    content,
    sourceNoteLinks,
    suggestedTags,
    synthesisType,
    createdAt: new Date(),
  };
}
