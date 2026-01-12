/**
 * Obsidian Note Repository
 * Obsidian Vault를 사용한 노트 저장소 구현
 */

import { normalizePath, type App, type TFile, type CachedMetadata } from 'obsidian';
import type { INoteRepository } from '../../core/domain/interfaces/note-repository.interface';
import type { NoteContent } from '../../core/domain/interfaces/synthesis-generator.interface';
import { generateNoteId } from '../../core/domain/utils/note-id';

export class ObsidianNoteRepository implements INoteRepository {
  constructor(private readonly app: App) {}

  /**
   * 노트 ID(hash)로 조회 - Vault Embeddings 호환
   */
  async getNote(noteId: string): Promise<NoteContent | null> {
    const files = this.app.vault.getMarkdownFiles();
    const file = files.find((f) => generateNoteId(f.path) === noteId);

    if (!file) {
      return null;
    }

    return this.fileToNoteContent(file);
  }

  /**
   * 노트 경로로 조회 (cross-platform safe)
   */
  async getNoteByPath(path: string): Promise<NoteContent | null> {
    const normalizedPath = normalizePath(path);
    const file = this.app.vault.getFileByPath(normalizedPath);
    if (!file) {
      return null;
    }
    return this.fileToNoteContent(file);
  }

  /**
   * 태그로 노트 목록 조회
   */
  async getNotesByTag(tag: string): Promise<NoteContent[]> {
    const notes: NoteContent[] = [];
    const files = this.app.vault.getMarkdownFiles();

    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      if (this.hasTag(cache, tag)) {
        const note = await this.fileToNoteContent(file);
        if (note) {
          notes.push(note);
        }
      }
    }

    return notes;
  }

  /**
   * 폴더로 노트 목록 조회 (cross-platform safe)
   */
  async getNotesByFolder(folder: string): Promise<NoteContent[]> {
    const notes: NoteContent[] = [];
    const files = this.app.vault.getMarkdownFiles();
    const normalizedFolder = normalizePath(folder);

    for (const file of files) {
      const fileFolder = file.parent?.path || '';
      if (fileFolder === normalizedFolder || fileFolder.startsWith(normalizedFolder + '/')) {
        const note = await this.fileToNoteContent(file);
        if (note) {
          notes.push(note);
        }
      }
    }

    return notes;
  }

  /**
   * 모든 노트 조회
   */
  async getAllNotes(): Promise<NoteContent[]> {
    const notes: NoteContent[] = [];
    const files = this.app.vault.getMarkdownFiles();

    for (const file of files) {
      const note = await this.fileToNoteContent(file);
      if (note) {
        notes.push(note);
      }
    }

    return notes;
  }

  /**
   * 노트 생성 (cross-platform safe)
   */
  async createNote(path: string, content: string): Promise<void> {
    const normalizedPath = normalizePath(path);
    // 부모 폴더가 없으면 생성
    const folderPath = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));
    if (folderPath) {
      const folder = this.app.vault.getAbstractFileByPath(folderPath);
      if (!folder) {
        try {
          await this.app.vault.createFolder(folderPath);
        } catch (e) {
          // Folder might already exist from sync - ignore
          const msg = e instanceof Error ? e.message : String(e);
          if (!msg.toLowerCase().includes('already exists')) {
            throw e;
          }
        }
      }
    }

    try {
      await this.app.vault.create(normalizedPath, content);
    } catch (e) {
      // File might already exist from sync - use adapter.write
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.toLowerCase().includes('already exists')) {
        await this.app.vault.adapter.write(normalizedPath, content);
      } else {
        throw e;
      }
    }
  }

  /**
   * 노트 수정 (cross-platform safe)
   */
  async updateNote(path: string, content: string): Promise<void> {
    const normalizedPath = normalizePath(path);
    const file = this.app.vault.getFileByPath(normalizedPath);
    if (file) {
      await this.app.vault.modify(file, content);
    }
  }

  /**
   * 모든 태그 목록
   */
  async getAllTags(): Promise<string[]> {
    const tags = new Set<string>();
    const files = this.app.vault.getMarkdownFiles();

    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      if (cache?.tags) {
        for (const tagCache of cache.tags) {
          tags.add(tagCache.tag.replace(/^#/, ''));
        }
      }
      // Frontmatter 태그도 포함
      if (cache?.frontmatter?.tags) {
        const fmTags = cache.frontmatter.tags;
        if (Array.isArray(fmTags)) {
          for (const tag of fmTags) {
            tags.add(String(tag).replace(/^#/, ''));
          }
        }
      }
    }

    return Array.from(tags).sort();
  }

  /**
   * 모든 폴더 목록
   */
  async getAllFolders(): Promise<string[]> {
    const folders = new Set<string>();
    const files = this.app.vault.getMarkdownFiles();

    for (const file of files) {
      const folder = file.parent?.path;
      if (folder && folder !== '/') {
        folders.add(folder);
      }
    }

    return Array.from(folders).sort();
  }

  /**
   * TFile을 NoteContent로 변환
   */
  private async fileToNoteContent(file: TFile): Promise<NoteContent | null> {
    try {
      const content = await this.app.vault.cachedRead(file);
      const cache = this.app.metadataCache.getFileCache(file);

      // 태그 추출
      const tags: string[] = [];
      if (cache?.tags) {
        for (const tagCache of cache.tags) {
          tags.push(tagCache.tag.replace(/^#/, ''));
        }
      }
      if (cache?.frontmatter?.tags) {
        const fmTags = cache.frontmatter.tags;
        if (Array.isArray(fmTags)) {
          for (const tag of fmTags) {
            tags.push(String(tag).replace(/^#/, ''));
          }
        }
      }

      // 본문 추출 (frontmatter 제거)
      const bodyContent = this.extractBody(content);

      return {
        noteId: generateNoteId(file.path), // Hash-based ID (Vault Embeddings 호환)
        notePath: file.path,
        title: cache?.frontmatter?.title || file.basename,
        content: bodyContent,
        tags: [...new Set(tags)], // 중복 제거
      };
    } catch (error) {
      console.error(`Error reading file ${file.path}:`, error);
      return null;
    }
  }

  /**
   * Frontmatter 제거하고 본문만 추출
   */
  private extractBody(content: string): string {
    const frontmatterRegex = /^---\n[\s\S]*?\n---\n*/;
    return content.replace(frontmatterRegex, '').trim();
  }

  /**
   * 태그 존재 여부 확인
   */
  private hasTag(cache: CachedMetadata | null, tag: string): boolean {
    if (!cache) return false;

    // 인라인 태그 확인
    if (cache.tags) {
      for (const tagCache of cache.tags) {
        const normalizedTag = tagCache.tag.replace(/^#/, '');
        if (normalizedTag === tag || normalizedTag.startsWith(tag + '/')) {
          return true;
        }
      }
    }

    // Frontmatter 태그 확인
    if (cache.frontmatter?.tags) {
      const fmTags = cache.frontmatter.tags;
      if (Array.isArray(fmTags)) {
        for (const fmTag of fmTags) {
          const normalizedTag = String(fmTag).replace(/^#/, '');
          if (normalizedTag === tag || normalizedTag.startsWith(tag + '/')) {
            return true;
          }
        }
      }
    }

    return false;
  }
}
