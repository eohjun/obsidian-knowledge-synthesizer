/**
 * Vault Embeddings Vector Store
 *
 * Vault Embeddings 플러그인이 생성한 임베딩을 읽어오는 읽기 전용 벡터 저장소.
 * 노트 임베딩 생성은 Vault Embeddings 플러그인이 담당하고,
 * 이 저장소는 저장된 임베딩을 읽어서 유사도 검색에 사용.
 */

import { App, TFile } from 'obsidian';
import type {
  IVectorStore,
  VectorSearchResult,
  VectorSearchOptions,
} from '../../core/domain/interfaces/vector-store.interface';
import type { EmbeddingVector } from '../../core/domain/interfaces/embedding-provider.interface';

/**
 * Vault Embeddings 인덱스 파일 구조 (실제 vault-embeddings 플러그인 구조)
 */
interface VaultEmbeddingNoteInfo {
  path: string;
  contentHash: string;
  updatedAt: string;
}

interface VaultEmbeddingIndex {
  version: string;
  totalNotes: number;
  lastUpdated: string;
  model: string;
  dimensions: number;
  notes: Record<string, VaultEmbeddingNoteInfo>;
}

/**
 * 임베딩 파일 구조
 */
interface EmbeddingFileContent {
  noteId: string;
  notePath: string;
  vector: number[];
  model: string;
  provider: string;
  contentHash: string;
  createdAt: string;
}

/**
 * 설정 인터페이스
 */
export interface VaultEmbeddingsVectorStoreConfig {
  /** Vault Embeddings 저장 경로 (기본: '09_Embedded') */
  storagePath?: string;
  /** 임베딩 폴더명 (기본: 'embeddings') */
  embeddingsFolder?: string;
}

/**
 * Vault Embeddings를 읽는 읽기 전용 벡터 저장소
 */
export class VaultEmbeddingsVectorStore implements IVectorStore {
  private app: App;
  private config: Required<VaultEmbeddingsVectorStoreConfig>;
  private cache: Map<string, EmbeddingVector> = new Map();
  private indexCache: VaultEmbeddingIndex | null = null;
  private lastCacheUpdate = 0;
  private initialized = false;

  /** 캐시 유효 시간 (1분) */
  private static readonly CACHE_TTL_MS = 60 * 1000;

  constructor(app: App, config?: VaultEmbeddingsVectorStoreConfig) {
    this.app = app;
    this.config = {
      storagePath: config?.storagePath ?? '09_Embedded',
      embeddingsFolder: config?.embeddingsFolder ?? 'embeddings',
    };
  }

  /**
   * 벡터 저장소 초기화
   * Vault Embeddings 데이터를 로드
   */
  async initialize(): Promise<void> {
    if (this.initialized && !this.isCacheStale()) {
      return;
    }

    await this.loadFromVaultEmbeddings();
    this.initialized = true;
    console.log(`[VaultEmbeddingsVectorStore] Loaded ${this.cache.size} embeddings`);
  }

  /**
   * 서비스 사용 가능 여부
   */
  isAvailable(): boolean {
    return this.cache.size > 0;
  }

  /**
   * 임베딩 통계
   */
  async getStats(): Promise<{
    isAvailable: boolean;
    totalEmbeddings: number;
    model: string;
    provider: string;
  }> {
    await this.refreshCacheIfStale();

    return {
      isAvailable: this.isAvailable(),
      totalEmbeddings: this.cache.size,
      model: this.indexCache?.model ?? 'unknown',
      provider: 'vault-embeddings', // Vault Embeddings 플러그인에서 관리
    };
  }

  /**
   * 캐시 갱신
   */
  async refresh(): Promise<void> {
    await this.loadFromVaultEmbeddings();
  }

  // ==========================================================================
  // IVectorStore 인터페이스 구현
  // ==========================================================================

  /**
   * 벡터 저장 (no-op - Vault Embeddings 플러그인이 담당)
   */
  store(_embedding: EmbeddingVector): void {
    console.info(
      '[VaultEmbeddingsVectorStore] store() is no-op. Use Vault Embeddings plugin to generate embeddings.'
    );
  }

  /**
   * 특정 노트의 임베딩 조회
   */
  get(noteId: string): EmbeddingVector | undefined {
    return this.cache.get(noteId);
  }

  /**
   * 유사 벡터 검색
   */
  search(queryVector: number[], options?: VectorSearchOptions): VectorSearchResult[] {
    const { limit = 10, threshold = 0.3, excludeNoteIds = [] } = options || {};

    const results: VectorSearchResult[] = [];

    for (const [noteId, embedding] of this.cache) {
      // 제외 목록 확인
      if (excludeNoteIds.includes(noteId)) {
        continue;
      }

      // 차원 불일치 스킵
      if (queryVector.length !== embedding.vector.length) {
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
    return results.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
  }

  /**
   * 저장된 노트 ID 목록
   */
  getStoredNoteIds(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * 노트 삭제 (no-op)
   */
  remove(_noteId: string): void {
    console.info(
      '[VaultEmbeddingsVectorStore] remove() is no-op. Use Vault Embeddings plugin to manage embeddings.'
    );
  }

  /**
   * 전체 초기화 (no-op)
   */
  clear(): void {
    console.info(
      '[VaultEmbeddingsVectorStore] clear() is no-op. Use Vault Embeddings plugin to manage embeddings.'
    );
  }

  /**
   * 저장된 벡터 수
   */
  size(): number {
    return this.cache.size;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * 캐시가 오래되었는지 확인
   */
  private isCacheStale(): boolean {
    return Date.now() - this.lastCacheUpdate > VaultEmbeddingsVectorStore.CACHE_TTL_MS;
  }

  /**
   * 필요 시 캐시 갱신
   */
  private async refreshCacheIfStale(): Promise<void> {
    if (this.isCacheStale()) {
      await this.loadFromVaultEmbeddings();
    }
  }

  /**
   * Vault Embeddings에서 데이터 로드
   */
  private async loadFromVaultEmbeddings(): Promise<void> {
    try {
      // 인덱스 파일 경로 (index.json은 storagePath 루트에 위치)
      const indexPath = `${this.config.storagePath}/index.json`;

      // 인덱스 파일 읽기
      const indexFile = this.app.vault.getAbstractFileByPath(indexPath);
      if (!indexFile || !(indexFile instanceof TFile)) {
        console.warn(`[VaultEmbeddingsVectorStore] Index file not found: ${indexPath}`);
        this.cache.clear();
        this.indexCache = null;
        return;
      }

      const indexContent = await this.app.vault.read(indexFile);
      const index: VaultEmbeddingIndex = JSON.parse(indexContent);
      this.indexCache = index;

      // 새 캐시 구성
      const newCache = new Map<string, EmbeddingVector>();

      // 각 임베딩 파일 로드 (noteId를 안전한 파일명으로 변환)
      for (const [noteId, noteInfo] of Object.entries(index.notes)) {
        try {
          // noteId를 안전한 파일명으로 변환 (vault-embeddings와 동일한 로직)
          const safeId = noteId.replace(/[^a-zA-Z0-9-_]/g, '_');
          const embeddingPath = `${this.config.storagePath}/${this.config.embeddingsFolder}/${safeId}.json`;
          const embeddingFile = this.app.vault.getAbstractFileByPath(embeddingPath);

          if (!embeddingFile || !(embeddingFile instanceof TFile)) {
            continue;
          }

          const content = await this.app.vault.read(embeddingFile);
          const embeddingData: EmbeddingFileContent = JSON.parse(content);

          newCache.set(noteId, {
            noteId: noteId,
            notePath: noteInfo.path,
            vector: embeddingData.vector,
            content: '', // 원본 콘텐츠는 저장하지 않음
          });
        } catch (err) {
          // 개별 파일 로드 실패는 무시
          console.warn(`[VaultEmbeddingsVectorStore] Failed to load embedding for: ${noteId}`);
        }
      }

      this.cache = newCache;
      this.lastCacheUpdate = Date.now();
    } catch (error) {
      console.error('[VaultEmbeddingsVectorStore] Failed to load embeddings:', error);
      this.cache.clear();
      this.indexCache = null;
    }
  }

  /**
   * 코사인 유사도 계산
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      return 0;
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
