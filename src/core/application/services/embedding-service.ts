/**
 * Embedding Service
 *
 * 쿼리 임베딩 생성 및 유사도 검색을 수행하는 서비스.
 * 노트 임베딩은 Vault Embeddings 플러그인이 담당하고,
 * 이 서비스는 검색 쿼리를 임베딩하여 유사 노트를 찾는 역할만 담당.
 */

import type { IEmbeddingProvider } from '../../domain/interfaces/embedding-provider.interface';
import type {
  IVectorStore,
  VectorSearchResult,
  VectorSearchOptions,
} from '../../domain/interfaces/vector-store.interface';

export class EmbeddingService {
  constructor(
    private readonly embeddingProvider: IEmbeddingProvider,
    private readonly vectorStore: IVectorStore
  ) {}

  /**
   * 서비스 사용 가능 여부
   * - OpenAI API 키가 설정되어 있고
   * - Vault Embeddings 데이터가 있어야 함
   */
  isAvailable(): boolean {
    return this.embeddingProvider.isAvailable() && this.vectorStore.size() > 0;
  }

  /**
   * 쿼리 텍스트와 유사한 노트 검색
   *
   * @param queryText - 검색 쿼리 (개념, 키워드 등)
   * @param options - 검색 옵션
   * @returns 유사도 순 검색 결과
   */
  async findSimilarByText(
    queryText: string,
    options?: VectorSearchOptions
  ): Promise<VectorSearchResult[]> {
    if (!this.embeddingProvider.isAvailable()) {
      console.warn('[EmbeddingService] Query embedding provider not available');
      return [];
    }

    if (this.vectorStore.size() === 0) {
      console.warn('[EmbeddingService] No embeddings available. Run Vault Embeddings plugin first.');
      return [];
    }

    try {
      const queryVector = await this.embeddingProvider.embed(queryText);
      return this.vectorStore.search(queryVector, options);
    } catch (error) {
      console.error('[EmbeddingService] Search by text failed:', error);
      return [];
    }
  }

  /**
   * 특정 노트와 유사한 노트 검색
   *
   * @param noteId - 기준 노트 ID
   * @param options - 검색 옵션
   * @returns 유사도 순 검색 결과 (자기 자신 제외)
   */
  findSimilarByNoteId(noteId: string, options?: VectorSearchOptions): VectorSearchResult[] {
    const embedding = this.vectorStore.get(noteId);
    if (!embedding) {
      console.warn(`[EmbeddingService] No embedding found for note: ${noteId}`);
      return [];
    }

    // 자기 자신 제외
    const searchOptions: VectorSearchOptions = {
      ...options,
      excludeNoteIds: [...(options?.excludeNoteIds || []), noteId],
    };

    return this.vectorStore.search(embedding.vector, searchOptions);
  }

  /**
   * 노트가 임베딩되어 있는지 확인
   *
   * @param noteId - 확인할 노트 ID
   */
  hasEmbedding(noteId: string): boolean {
    return !!this.vectorStore.get(noteId);
  }

  /**
   * 임베딩 통계
   */
  getStats(): { totalNotes: number } {
    return {
      totalNotes: this.vectorStore.size(),
    };
  }

  /**
   * 저장된 노트 ID 목록
   */
  getStoredNoteIds(): string[] {
    return this.vectorStore.getStoredNoteIds();
  }
}
