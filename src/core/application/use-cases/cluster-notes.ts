/**
 * Cluster Notes Use Case
 * 노트 클러스터링 유스케이스
 */

import type { INoteRepository } from '../../domain/interfaces/note-repository.interface';
import type { NoteContent } from '../../domain/interfaces/synthesis-generator.interface';
import {
  NoteCluster,
  ClusterMember,
  createNoteCluster,
} from '../../domain/entities/note-cluster';
import type { EmbeddingService, EmbedNoteInput } from '../services/embedding-service';

export interface ClusterOptions {
  excludedFolders?: string[];
}

export class ClusterNotesUseCase {
  private excludedFolders: string[] = [];

  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly noteRepository: INoteRepository
  ) {}

  /**
   * 제외 폴더 설정
   */
  setExcludedFolders(folders: string[]): void {
    this.excludedFolders = folders;
  }

  /**
   * 노트가 제외 폴더에 있는지 확인
   */
  private isExcludedPath(notePath: string): boolean {
    return this.excludedFolders.some(excluded =>
      notePath.startsWith(excluded + '/')
    );
  }

  /**
   * 제외 폴더의 노트 필터링
   */
  private filterExcludedNotes<T extends { notePath: string }>(notes: T[]): T[] {
    if (this.excludedFolders.length === 0) {
      return notes;
    }
    return notes.filter(note => !this.isExcludedPath(note.notePath));
  }

  /**
   * 태그 기반 클러스터링
   */
  async clusterByTag(tag: string): Promise<NoteCluster> {
    const allNotes = await this.noteRepository.getNotesByTag(tag);
    const notes = this.filterExcludedNotes(allNotes);

    if (notes.length === 0) {
      return createNoteCluster(`#${tag}`, [], 'tag', 0);
    }

    // 임베딩 생성
    await this.embedNotes(notes);

    // 클러스터 멤버 생성
    const members = this.createMembers(notes);

    // 응집도 계산
    const coherenceScore = await this.calculateCoherence(notes);

    return createNoteCluster(`#${tag}`, members, 'tag', coherenceScore);
  }

  /**
   * 폴더 기반 클러스터링
   */
  async clusterByFolder(folder: string): Promise<NoteCluster> {
    const notes = await this.noteRepository.getNotesByFolder(folder);

    if (notes.length === 0) {
      return createNoteCluster(folder, [], 'folder', 0);
    }

    await this.embedNotes(notes);
    const members = this.createMembers(notes);
    const coherenceScore = await this.calculateCoherence(notes);

    return createNoteCluster(folder, members, 'folder', coherenceScore);
  }

  /**
   * 유사도 기반 자동 클러스터링
   * 시드 노트에서 시작하여 유사한 노트들을 수집
   */
  async autoCluster(
    seedNoteId: string,
    threshold: number = 0.5,
    maxSize: number = 20
  ): Promise<NoteCluster> {
    // 시드 노트 확인
    const seedNote = await this.noteRepository.getNote(seedNoteId);
    if (!seedNote) {
      return createNoteCluster('Unknown', [], 'similarity', 0);
    }

    // 시드 노트가 제외 폴더에 있으면 빈 클러스터 반환
    if (this.isExcludedPath(seedNote.notePath)) {
      return createNoteCluster('Unknown', [], 'similarity', 0);
    }

    // 시드 노트 임베딩
    await this.embeddingService.embedNote({
      noteId: seedNote.noteId,
      notePath: seedNote.notePath,
      content: `${seedNote.title}\n\n${seedNote.content}`,
    });

    // 유사 노트 검색 (제외 폴더 필터링)
    const allSimilarNotes = this.embeddingService.findSimilarByNoteId(seedNoteId, {
      threshold,
      limit: maxSize * 2, // 필터링을 위해 더 많이 조회
    });
    const similarNotes = allSimilarNotes
      .filter(note => !this.isExcludedPath(note.notePath))
      .slice(0, maxSize - 1);

    // 노트 내용 조회
    const notes: NoteContent[] = [seedNote];
    for (const result of similarNotes) {
      const note = await this.noteRepository.getNoteByPath(result.notePath);
      if (note) {
        notes.push(note);
      }
    }

    // 클러스터 멤버 생성 (유사도 포함)
    const members: ClusterMember[] = [
      {
        noteId: seedNote.noteId,
        notePath: seedNote.notePath,
        title: seedNote.title,
        similarity: 1.0, // 시드 노트는 유사도 1.0
      },
      ...similarNotes.map((r) => ({
        noteId: r.noteId,
        notePath: r.notePath,
        title: r.noteId, // TODO: 실제 제목으로 대체
        similarity: r.similarity,
      })),
    ];

    // 평균 유사도를 응집도로 사용
    const coherenceScore =
      members.length > 1
        ? members.slice(1).reduce((sum, m) => sum + m.similarity, 0) / (members.length - 1)
        : 1.0;

    return createNoteCluster(
      `Similar to: ${seedNote.title}`,
      members,
      'similarity',
      coherenceScore
    );
  }

  /**
   * 수동 선택 클러스터 생성
   */
  async createManualCluster(noteIds: string[], name: string): Promise<NoteCluster> {
    const notes: NoteContent[] = [];

    for (const noteId of noteIds) {
      const note = await this.noteRepository.getNote(noteId);
      if (note) {
        notes.push(note);
      }
    }

    if (notes.length === 0) {
      return createNoteCluster(name, [], 'manual', 0);
    }

    await this.embedNotes(notes);
    const members = this.createMembers(notes);
    const coherenceScore = await this.calculateCoherence(notes);

    return createNoteCluster(name, members, 'manual', coherenceScore);
  }

  /**
   * 노트들의 임베딩 생성
   */
  private async embedNotes(notes: NoteContent[]): Promise<void> {
    const inputs: EmbedNoteInput[] = notes.map((note) => ({
      noteId: note.noteId,
      notePath: note.notePath,
      content: `${note.title}\n\n${note.content}`,
    }));
    await this.embeddingService.embedNotes(inputs);
  }

  /**
   * 클러스터 멤버 생성
   */
  private createMembers(notes: NoteContent[]): ClusterMember[] {
    return notes.map((note) => ({
      noteId: note.noteId,
      notePath: note.notePath,
      title: note.title,
      similarity: 1.0, // 태그/폴더 기반은 유사도 1.0으로 설정
    }));
  }

  /**
   * 클러스터 응집도 계산 (멤버 간 평균 유사도)
   */
  private async calculateCoherence(notes: NoteContent[]): Promise<number> {
    if (notes.length < 2) {
      return 1.0;
    }

    let totalSimilarity = 0;
    let pairCount = 0;

    for (let i = 0; i < notes.length; i++) {
      const similarNotes = this.embeddingService.findSimilarByNoteId(notes[i].noteId, {
        limit: notes.length - 1,
      });

      for (const similar of similarNotes) {
        if (notes.some((n) => n.noteId === similar.noteId)) {
          totalSimilarity += similar.similarity;
          pairCount++;
        }
      }
    }

    return pairCount > 0 ? totalSimilarity / pairCount : 0;
  }
}
