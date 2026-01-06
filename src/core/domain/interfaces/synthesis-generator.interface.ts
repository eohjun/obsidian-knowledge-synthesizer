/**
 * Synthesis Generator Interface
 * AI를 사용한 합성 생성 인터페이스 (Port)
 */

import type { SynthesisRequest, SynthesisType } from '../entities/synthesis-request';
import type { SynthesisResult } from '../entities/synthesis-result';

export interface NoteContent {
  /** 노트 ID */
  noteId: string;
  /** 노트 경로 */
  notePath: string;
  /** 노트 제목 */
  title: string;
  /** 노트 본문 내용 */
  content: string;
  /** 노트 태그 목록 */
  tags: string[];
}

export interface ISynthesisGenerator {
  /**
   * 합성 노트 생성
   * @param request 합성 요청
   * @param noteContents 원본 노트 내용들
   * @returns 합성 결과
   */
  generate(request: SynthesisRequest, noteContents: NoteContent[]): Promise<SynthesisResult>;

  /**
   * 합성 노트 제목 제안
   * @param noteContents 원본 노트 내용들
   * @returns 제안된 제목
   */
  suggestTitle(noteContents: NoteContent[]): Promise<string>;

  /**
   * 적절한 합성 타입 제안
   * @param noteContents 원본 노트 내용들
   * @returns 제안된 합성 타입
   */
  suggestType(noteContents: NoteContent[]): Promise<SynthesisType>;

  /**
   * 프로바이더 사용 가능 여부
   */
  isAvailable(): boolean;
}
