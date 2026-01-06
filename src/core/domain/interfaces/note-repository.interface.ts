/**
 * Note Repository Interface
 * 노트 저장소 인터페이스 (Port)
 */

import type { NoteContent } from './synthesis-generator.interface';

export interface INoteRepository {
  /**
   * 특정 노트 조회
   * @param noteId 노트 ID (basename)
   * @returns 노트 내용 또는 null
   */
  getNote(noteId: string): Promise<NoteContent | null>;

  /**
   * 노트 경로로 조회
   * @param path 노트 경로
   * @returns 노트 내용 또는 null
   */
  getNoteByPath(path: string): Promise<NoteContent | null>;

  /**
   * 태그로 노트 목록 조회
   * @param tag 태그명 (# 제외)
   * @returns 해당 태그가 있는 노트 목록
   */
  getNotesByTag(tag: string): Promise<NoteContent[]>;

  /**
   * 폴더로 노트 목록 조회
   * @param folder 폴더 경로
   * @returns 해당 폴더 내 노트 목록
   */
  getNotesByFolder(folder: string): Promise<NoteContent[]>;

  /**
   * 모든 노트 조회
   * @returns 전체 노트 목록
   */
  getAllNotes(): Promise<NoteContent[]>;

  /**
   * 노트 생성
   * @param path 생성할 경로
   * @param content 마크다운 내용
   */
  createNote(path: string, content: string): Promise<void>;

  /**
   * 노트 수정
   * @param path 수정할 노트 경로
   * @param content 새 마크다운 내용
   */
  updateNote(path: string, content: string): Promise<void>;

  /**
   * 모든 태그 목록 조회
   * @returns 볼트 내 모든 태그 목록
   */
  getAllTags(): Promise<string[]>;

  /**
   * 모든 폴더 목록 조회
   * @returns 노트가 있는 폴더 목록
   */
  getAllFolders(): Promise<string[]>;
}
