/**
 * Suggest Synthesis Use Case
 * 합성 후보 클러스터 추천 유스케이스
 */

import type { INoteRepository } from '../../domain/interfaces/note-repository.interface';
import type { NoteCluster } from '../../domain/entities/note-cluster';
import type { ClusterNotesUseCase } from './cluster-notes';

export interface SynthesisSuggestion {
  cluster: NoteCluster;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  suggestedType: 'framework' | 'summary' | 'comparison' | 'timeline';
}

export interface SuggestSynthesisOptions {
  minClusterSize?: number;
  maxSuggestions?: number;
  minCoherence?: number;
  excludedFolders?: string[];
}

export class SuggestSynthesisUseCase {
  constructor(
    private readonly clusterNotesUseCase: ClusterNotesUseCase,
    private readonly noteRepository: INoteRepository
  ) {}

  /**
   * 태그 기반 합성 후보 추천
   */
  async suggestByTags(options?: SuggestSynthesisOptions): Promise<SynthesisSuggestion[]> {
    const {
      minClusterSize = 3,
      maxSuggestions = 5,
      minCoherence = 0.4,
    } = options || {};

    // 모든 태그 조회
    const tags = await this.noteRepository.getAllTags();
    const suggestions: SynthesisSuggestion[] = [];

    for (const tag of tags) {
      const cluster = await this.clusterNotesUseCase.clusterByTag(tag);

      // 최소 크기 및 응집도 조건 확인
      if (cluster.members.length >= minClusterSize && cluster.coherenceScore >= minCoherence) {
        suggestions.push({
          cluster,
          reason: `${cluster.members.length}개의 노트가 #${tag} 태그로 연결됨 (응집도: ${(cluster.coherenceScore * 100).toFixed(0)}%)`,
          priority: this.calculatePriority(cluster),
          suggestedType: this.suggestSynthesisType(cluster),
        });
      }
    }

    // 우선순위 정렬 후 상위 N개 반환
    return this.sortAndLimit(suggestions, maxSuggestions);
  }

  /**
   * 폴더 기반 합성 후보 추천
   */
  async suggestByFolders(options?: SuggestSynthesisOptions): Promise<SynthesisSuggestion[]> {
    const {
      minClusterSize = 3,
      maxSuggestions = 5,
      minCoherence = 0.3,
      excludedFolders = [],
    } = options || {};

    // 모든 폴더 조회
    const allFolders = await this.noteRepository.getAllFolders();

    // 제외 폴더 필터링 (폴더 경로가 excludedFolders로 시작하면 제외)
    const folders = allFolders.filter(folder =>
      !excludedFolders.some(excluded =>
        folder === excluded || folder.startsWith(excluded + '/')
      )
    );

    const suggestions: SynthesisSuggestion[] = [];

    for (const folder of folders) {
      const cluster = await this.clusterNotesUseCase.clusterByFolder(folder);

      if (cluster.members.length >= minClusterSize && cluster.coherenceScore >= minCoherence) {
        suggestions.push({
          cluster,
          reason: `${cluster.members.length}개의 노트가 ${folder} 폴더에 위치 (응집도: ${(cluster.coherenceScore * 100).toFixed(0)}%)`,
          priority: this.calculatePriority(cluster),
          suggestedType: this.suggestSynthesisType(cluster),
        });
      }
    }

    return this.sortAndLimit(suggestions, maxSuggestions);
  }

  /**
   * 유사도 기반 자동 추천
   * 최근 활성화된 노트를 시드로 사용
   */
  async suggestBySimilarity(
    seedNoteIds: string[],
    options?: SuggestSynthesisOptions
  ): Promise<SynthesisSuggestion[]> {
    const {
      minClusterSize = 3,
      maxSuggestions = 5,
      minCoherence = 0.5,
    } = options || {};

    const suggestions: SynthesisSuggestion[] = [];

    for (const seedNoteId of seedNoteIds) {
      const cluster = await this.clusterNotesUseCase.autoCluster(seedNoteId, 0.5, 15);

      if (cluster.members.length >= minClusterSize && cluster.coherenceScore >= minCoherence) {
        const seedNote = cluster.members.find((m) => m.noteId === seedNoteId);
        suggestions.push({
          cluster,
          reason: `"${seedNote?.title || seedNoteId}"와 의미적으로 유사한 ${cluster.members.length}개 노트 (응집도: ${(cluster.coherenceScore * 100).toFixed(0)}%)`,
          priority: this.calculatePriority(cluster),
          suggestedType: 'framework', // 유사도 기반은 종합 프레임워크 추천
        });
      }
    }

    return this.sortAndLimit(suggestions, maxSuggestions);
  }

  /**
   * 의미 기반 추천 (임베딩 유사도 클러스터링)
   * 태그/폴더 기반은 효용성이 낮아 제거됨
   */
  async suggestAll(
    recentNoteIds: string[],
    options?: SuggestSynthesisOptions
  ): Promise<SynthesisSuggestion[]> {
    const maxSuggestions = options?.maxSuggestions ?? 10;

    // 유사도 기반 추천만 사용 (태그/폴더 기반은 효용성이 낮음)
    const similaritySuggestions = await this.suggestBySimilarity(
      recentNoteIds,
      { ...options, maxSuggestions }
    );

    return this.deduplicateSuggestions(similaritySuggestions);
  }

  /**
   * 우선순위 계산
   */
  private calculatePriority(cluster: NoteCluster): 'high' | 'medium' | 'low' {
    const score = cluster.coherenceScore * Math.min(cluster.members.length / 10, 1);

    if (score >= 0.6) return 'high';
    if (score >= 0.3) return 'medium';
    return 'low';
  }

  /**
   * 합성 타입 추천
   */
  private suggestSynthesisType(
    cluster: NoteCluster
  ): 'framework' | 'summary' | 'comparison' | 'timeline' {
    const memberCount = cluster.members.length;

    // 노트 수에 따른 추천
    if (memberCount >= 7) {
      return 'framework'; // 많은 노트는 종합 프레임워크
    } else if (memberCount >= 4) {
      return 'comparison'; // 중간 정도는 비교 분석
    } else {
      return 'summary'; // 적은 노트는 요약
    }
  }

  /**
   * 정렬 및 제한
   */
  private sortAndLimit(
    suggestions: SynthesisSuggestion[],
    maxSuggestions: number
  ): SynthesisSuggestion[] {
    const priorityOrder: Record<string, number> = {
      high: 3,
      medium: 2,
      low: 1,
    };

    return suggestions
      .sort((a, b) => {
        // 우선순위로 먼저 정렬
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;

        // 같은 우선순위면 응집도로 정렬
        return b.cluster.coherenceScore - a.cluster.coherenceScore;
      })
      .slice(0, maxSuggestions);
  }

  /**
   * 중복 제거 (같은 노트 집합을 가진 클러스터)
   */
  private deduplicateSuggestions(suggestions: SynthesisSuggestion[]): SynthesisSuggestion[] {
    const seen = new Set<string>();
    return suggestions.filter((suggestion) => {
      const key = suggestion.cluster.members
        .map((m) => m.noteId)
        .sort()
        .join(',');

      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
}
