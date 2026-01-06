/**
 * Embedding Provider Interface
 * 텍스트를 벡터로 변환하는 프로바이더 인터페이스 (Port)
 */

export interface EmbeddingVector {
  /** 노트 ID */
  noteId: string;
  /** 노트 경로 */
  notePath: string;
  /** 임베딩 벡터 */
  vector: number[];
  /** 원본 텍스트 (디버깅용, 선택) */
  content?: string;
}

export interface IEmbeddingProvider {
  /**
   * 단일 텍스트를 벡터로 변환
   * @param text 변환할 텍스트
   * @returns 임베딩 벡터
   */
  embed(text: string): Promise<number[]>;

  /**
   * 여러 텍스트를 배치로 변환
   * @param texts 변환할 텍스트 배열
   * @returns 임베딩 벡터 배열
   */
  embedBatch(texts: string[]): Promise<number[][]>;

  /**
   * 프로바이더 사용 가능 여부
   * @returns API 키가 설정되어 있고 사용 가능한지 여부
   */
  isAvailable(): boolean;

  /**
   * 벡터 차원 수
   * @returns 임베딩 벡터의 차원 수
   */
  getDimensions(): number;
}
