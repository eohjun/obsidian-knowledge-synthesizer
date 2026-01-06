/**
 * Synthesize Notes Use Case
 * 노트 합성 유스케이스 - 여러 노트를 하나의 종합 노트로 합성
 */

import type { ISynthesisGenerator, NoteContent } from '../../domain/interfaces/synthesis-generator.interface';
import type { INoteRepository } from '../../domain/interfaces/note-repository.interface';
import type { NoteCluster } from '../../domain/entities/note-cluster';
import {
  SynthesisRequest,
  SynthesisType,
  SynthesisOptions,
  createSynthesisRequest,
} from '../../domain/entities/synthesis-request';
import type { SynthesisResult } from '../../domain/entities/synthesis-result';

export interface SynthesizeNotesInput {
  cluster: NoteCluster;
  synthesisType: SynthesisType;
  targetTitle?: string;
  options?: Partial<SynthesisOptions>;
}

export interface SynthesizeNotesOutput {
  result: SynthesisResult;
  request: SynthesisRequest;
}

export class SynthesizeNotesUseCase {
  constructor(
    private readonly synthesisGenerator: ISynthesisGenerator,
    private readonly noteRepository: INoteRepository
  ) {}

  /**
   * 클러스터의 노트들을 합성하여 새로운 노트 생성
   */
  async execute(input: SynthesizeNotesInput): Promise<SynthesizeNotesOutput> {
    const { cluster, synthesisType, targetTitle, options } = input;

    // 노트 ID 추출
    const noteIds = cluster.members.map((m) => m.noteId);

    if (noteIds.length === 0) {
      throw new Error('No notes to synthesize');
    }

    // 합성 요청 생성
    const request = createSynthesisRequest(noteIds, synthesisType, options);

    // targetTitle 설정 (createSynthesisRequest 후 수동 설정)
    if (targetTitle) {
      request.targetTitle = targetTitle;
    } else {
      request.targetTitle = this.generateDefaultTitle(cluster, synthesisType);
    }

    // 노트 내용 조회
    const noteContents = await this.fetchNoteContents(noteIds);

    if (noteContents.length === 0) {
      throw new Error('Could not fetch any note contents');
    }

    // 합성 생성 (ISynthesisGenerator가 SynthesisResult를 직접 반환)
    const result = await this.synthesisGenerator.generate(request, noteContents);

    return { result, request };
  }

  /**
   * 합성 결과를 파일로 저장
   */
  async saveResult(result: SynthesisResult, folderPath: string): Promise<string> {
    const fileName = this.sanitizeFileName(result.title);
    const filePath = `${folderPath}/${fileName}.md`;

    // 프런트매터 생성
    const frontmatter = this.generateFrontmatter(result);

    // 최종 콘텐츠 생성
    const content = `${frontmatter}\n${result.content}`;

    // 파일 저장
    await this.noteRepository.createNote(filePath, content);

    return filePath;
  }

  /**
   * 노트 내용 조회
   */
  private async fetchNoteContents(noteIds: string[]): Promise<NoteContent[]> {
    const contents: NoteContent[] = [];

    for (const noteId of noteIds) {
      const note = await this.noteRepository.getNote(noteId);
      if (note) {
        contents.push(note);
      }
    }

    return contents;
  }

  /**
   * 기본 제목 생성
   */
  private generateDefaultTitle(cluster: NoteCluster, type: SynthesisType): string {
    const typeLabels: Record<SynthesisType, string> = {
      framework: '종합 프레임워크',
      summary: '요약',
      comparison: '비교 분석',
      timeline: '타임라인',
    };

    return `${cluster.name} - ${typeLabels[type]}`;
  }

  /**
   * 파일명 정제
   */
  private sanitizeFileName(title: string): string {
    return title
      .replace(/[\\/:*?"<>|]/g, '') // 파일명 금지 문자 제거
      .replace(/\s+/g, ' ') // 연속 공백 제거
      .trim()
      .substring(0, 100); // 최대 길이 제한
  }

  /**
   * 프런트매터 생성
   */
  private generateFrontmatter(result: SynthesisResult): string {
    const lines = [
      '---',
      `title: "${result.title}"`,
      `type: synthesis`,
      `synthesis_type: ${result.synthesisType}`,
      `created: ${result.createdAt.toISOString()}`,
      `sources:`,
      ...result.sourceNoteLinks.map((link) => `  - "${link}"`),
    ];

    if (result.suggestedTags.length > 0) {
      lines.push(`tags:`);
      lines.push(...result.suggestedTags.map((tag) => `  - "${tag}"`));
    }

    lines.push('---', '');

    return lines.join('\n');
  }
}
