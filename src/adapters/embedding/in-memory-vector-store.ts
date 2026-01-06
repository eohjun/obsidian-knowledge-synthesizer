/**
 * In-Memory Vector Store
 * 메모리 내 벡터 저장소 구현
 */

import type {
  IVectorStore,
  VectorSearchResult,
  VectorSearchOptions,
} from '../../core/domain/interfaces/vector-store.interface';
import type { EmbeddingVector } from '../../core/domain/interfaces/embedding-provider.interface';

export class InMemoryVectorStore implements IVectorStore {
  private vectors: Map<string, EmbeddingVector> = new Map();

  /**
   * 벡터 저장
   */
  store(embedding: EmbeddingVector): void {
    this.vectors.set(embedding.noteId, embedding);
  }

  /**
   * 벡터 조회
   */
  get(noteId: string): EmbeddingVector | undefined {
    return this.vectors.get(noteId);
  }

  /**
   * 유사 벡터 검색 (코사인 유사도)
   */
  search(queryVector: number[], options?: VectorSearchOptions): VectorSearchResult[] {
    const {
      limit = 10,
      threshold = 0.3,
      excludeNoteIds = [],
    } = options || {};

    const results: VectorSearchResult[] = [];

    for (const [noteId, embedding] of this.vectors) {
      // 제외 목록 확인
      if (excludeNoteIds.includes(noteId)) {
        continue;
      }

      // 코사인 유사도 계산
      const similarity = this.cosineSimilarity(queryVector, embedding.vector);

      // 임계값 이상만 포함
      if (similarity >= threshold) {
        results.push({
          noteId,
          notePath: embedding.notePath,
          similarity,
        });
      }
    }

    // 유사도 내림차순 정렬 후 상위 N개 반환
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * 저장된 노트 ID 목록
   */
  getStoredNoteIds(): string[] {
    return Array.from(this.vectors.keys());
  }

  /**
   * 특정 노트 삭제
   */
  remove(noteId: string): void {
    this.vectors.delete(noteId);
  }

  /**
   * 전체 초기화
   */
  clear(): void {
    this.vectors.clear();
  }

  /**
   * 저장된 벡터 수
   */
  size(): number {
    return this.vectors.size;
  }

  /**
   * 코사인 유사도 계산
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);

    if (magnitude === 0) {
      return 0;
    }

    return dotProduct / magnitude;
  }
}
