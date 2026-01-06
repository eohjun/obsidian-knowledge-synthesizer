/**
 * Vector Store Interface
 * 벡터 저장 및 유사도 검색 인터페이스 (Port)
 */

import type { EmbeddingVector } from './embedding-provider.interface';

export interface VectorSearchResult {
  /** 노트 ID */
  noteId: string;
  /** 노트 경로 */
  notePath: string;
  /** 유사도 점수 (0.0 ~ 1.0) */
  similarity: number;
}

export interface VectorSearchOptions {
  /** 반환할 최대 결과 수 */
  limit?: number;
  /** 최소 유사도 임계값 */
  threshold?: number;
  /** 제외할 노트 ID 목록 */
  excludeNoteIds?: string[];
}

export interface IVectorStore {
  /**
   * 벡터 저장
   * @param embedding 저장할 임베딩 벡터
   */
  store(embedding: EmbeddingVector): void;

  /**
   * 유사 벡터 검색
   * @param queryVector 쿼리 벡터
   * @param options 검색 옵션
   * @returns 유사한 노트 목록 (유사도 내림차순)
   */
  search(queryVector: number[], options?: VectorSearchOptions): VectorSearchResult[];

  /**
   * 저장된 노트 ID 목록 반환
   */
  getStoredNoteIds(): string[];

  /**
   * 특정 노트의 벡터 조회
   * @param noteId 노트 ID
   * @returns 해당 노트의 임베딩 벡터 또는 undefined
   */
  get(noteId: string): EmbeddingVector | undefined;

  /**
   * 특정 노트 삭제
   * @param noteId 삭제할 노트 ID
   */
  remove(noteId: string): void;

  /**
   * 전체 초기화
   */
  clear(): void;

  /**
   * 저장된 벡터 수
   */
  size(): number;
}
