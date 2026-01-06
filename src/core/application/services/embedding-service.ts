/**
 * Embedding Service
 * 임베딩 생성 및 관리 서비스
 */

import type {
  IEmbeddingProvider,
  EmbeddingVector,
} from '../../domain/interfaces/embedding-provider.interface';
import type {
  IVectorStore,
  VectorSearchResult,
  VectorSearchOptions,
} from '../../domain/interfaces/vector-store.interface';

export interface EmbedNoteInput {
  noteId: string;
  notePath: string;
  content: string;
}

export class EmbeddingService {
  constructor(
    private readonly embeddingProvider: IEmbeddingProvider,
    private readonly vectorStore: IVectorStore
  ) {}

  /**
   * 단일 노트 임베딩 및 저장
   */
  async embedNote(input: EmbedNoteInput): Promise<void> {
    const { noteId, notePath, content } = input;

    // 이미 임베딩이 있으면 스킵
    if (this.vectorStore.get(noteId)) {
      return;
    }

    const vector = await this.embeddingProvider.embed(content);
    const embedding: EmbeddingVector = {
      noteId,
      notePath,
      vector,
      content: content.substring(0, 500), // 디버깅용으로 일부만 저장
    };
    this.vectorStore.store(embedding);
  }

  /**
   * 여러 노트 배치 임베딩
   */
  async embedNotes(
    inputs: EmbedNoteInput[],
    onProgress?: (current: number, total: number) => void
  ): Promise<void> {
    // 이미 임베딩된 노트 제외
    const toEmbed = inputs.filter((input) => !this.vectorStore.get(input.noteId));

    if (toEmbed.length === 0) {
      return;
    }

    // 배치 처리 (한 번에 너무 많이 보내지 않도록)
    const batchSize = 10;
    let processed = 0;

    for (let i = 0; i < toEmbed.length; i += batchSize) {
      const batch = toEmbed.slice(i, i + batchSize);
      const texts = batch.map((b) => b.content);

      const vectors = await this.embeddingProvider.embedBatch(texts);

      for (let j = 0; j < batch.length; j++) {
        const input = batch[j];
        const embedding: EmbeddingVector = {
          noteId: input.noteId,
          notePath: input.notePath,
          vector: vectors[j],
          content: input.content.substring(0, 500),
        };
        this.vectorStore.store(embedding);
      }

      processed += batch.length;
      onProgress?.(processed, toEmbed.length);
    }
  }

  /**
   * 쿼리 텍스트와 유사한 노트 검색
   */
  async findSimilarByText(
    queryText: string,
    options?: VectorSearchOptions
  ): Promise<VectorSearchResult[]> {
    const queryVector = await this.embeddingProvider.embed(queryText);
    return this.vectorStore.search(queryVector, options);
  }

  /**
   * 특정 노트와 유사한 노트 검색
   */
  findSimilarByNoteId(
    noteId: string,
    options?: VectorSearchOptions
  ): VectorSearchResult[] {
    const embedding = this.vectorStore.get(noteId);
    if (!embedding) {
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
   * 서비스 사용 가능 여부
   */
  isAvailable(): boolean {
    return this.embeddingProvider.isAvailable();
  }

  /**
   * 모든 임베딩 초기화
   */
  clear(): void {
    this.vectorStore.clear();
  }
}
