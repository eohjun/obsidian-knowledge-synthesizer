/**
 * Synthesis View
 * 합성 사이드바 뷰
 */

import { ItemView, WorkspaceLeaf, Notice, setIcon } from 'obsidian';
import type KnowledgeSynthesizerPlugin from '../main';
import type { SynthesisSuggestion } from '../core/application/use-cases/suggest-synthesis';
import type { SynthesisType } from '../core/domain/entities/synthesis-request';

export const SYNTHESIS_VIEW_TYPE = 'knowledge-synthesizer-view';

export class SynthesisView extends ItemView {
  private plugin: KnowledgeSynthesizerPlugin;
  private suggestions: SynthesisSuggestion[] = [];
  private isLoading = false;

  constructor(leaf: WorkspaceLeaf, plugin: KnowledgeSynthesizerPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return SYNTHESIS_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Knowledge Synthesizer';
  }

  getIcon(): string {
    return 'layers';
  }

  async onOpen(): Promise<void> {
    await this.render();
  }

  async onClose(): Promise<void> {
    // 정리 작업
  }

  private async render(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('synthesis-view-container');

    // 헤더
    const header = container.createDiv({ cls: 'synthesis-view-header' });
    header.createEl('h4', { text: 'Knowledge Synthesizer' });

    // API 키 확인
    if (!this.plugin.isConfigured()) {
      const warning = container.createDiv({ cls: 'synthesis-warning' });
      warning.createEl('p', { text: '⚠️ API 키가 설정되지 않았습니다.' });
      warning.createEl('p', { text: '설정에서 OpenAI API 키를 입력하세요.' });
      return;
    }

    // 새로고침 버튼
    const actions = container.createDiv({ cls: 'synthesis-actions' });
    const refreshBtn = actions.createEl('button', { text: '추천 새로고침' });
    refreshBtn.addEventListener('click', () => this.loadSuggestions());

    // 로딩 상태
    if (this.isLoading) {
      const loading = container.createDiv({ cls: 'synthesis-loading' });
      loading.createEl('p', { text: '분석 중...' });
      return;
    }

    // 추천 목록
    if (this.suggestions.length === 0) {
      const empty = container.createDiv({ cls: 'synthesis-empty' });
      empty.createEl('p', { text: '합성 가능한 클러스터가 없습니다.' });
      empty.createEl('p', { text: '노트를 추가하거나 태그를 사용해보세요.' });
      return;
    }

    const suggestionList = container.createDiv({ cls: 'synthesis-suggestions' });

    for (const suggestion of this.suggestions) {
      this.renderSuggestion(suggestionList, suggestion);
    }
  }

  private renderSuggestion(container: HTMLElement, suggestion: SynthesisSuggestion): void {
    const card = container.createDiv({ cls: 'synthesis-suggestion-card' });

    // 헤더
    const cardHeader = card.createDiv({ cls: 'suggestion-header' });

    const priorityIcon = cardHeader.createSpan({ cls: `priority-icon priority-${suggestion.priority}` });
    setIcon(priorityIcon, this.getPriorityIcon(suggestion.priority));

    cardHeader.createEl('span', { text: suggestion.cluster.name, cls: 'suggestion-title' });

    // 정보
    const info = card.createDiv({ cls: 'suggestion-info' });
    info.createEl('span', { text: `${suggestion.cluster.members.length}개 노트` });
    info.createEl('span', { text: `응집도: ${(suggestion.cluster.coherenceScore * 100).toFixed(0)}%` });

    // 이유
    card.createEl('p', { text: suggestion.reason, cls: 'suggestion-reason' });

    // 노트 목록 (접을 수 있음)
    const noteList = card.createDiv({ cls: 'suggestion-notes' });
    const toggleBtn = noteList.createEl('button', { text: '노트 목록 보기', cls: 'toggle-notes' });
    const noteListContent = noteList.createDiv({ cls: 'note-list-content hidden' });

    for (const member of suggestion.cluster.members.slice(0, 10)) {
      noteListContent.createEl('div', { text: `• ${member.title}`, cls: 'note-item' });
    }
    if (suggestion.cluster.members.length > 10) {
      noteListContent.createEl('div', {
        text: `... 그 외 ${suggestion.cluster.members.length - 10}개`,
        cls: 'note-item more',
      });
    }

    toggleBtn.addEventListener('click', () => {
      noteListContent.classList.toggle('hidden');
      toggleBtn.textContent = noteListContent.classList.contains('hidden')
        ? '노트 목록 보기'
        : '노트 목록 숨기기';
    });

    // 합성 버튼
    const actions = card.createDiv({ cls: 'suggestion-actions' });

    const typeSelect = actions.createEl('select', { cls: 'synthesis-type-select' });
    const types: { value: SynthesisType; label: string }[] = [
      { value: 'framework', label: '종합 프레임워크' },
      { value: 'summary', label: '요약' },
      { value: 'comparison', label: '비교 분석' },
      { value: 'timeline', label: '타임라인' },
    ];
    for (const type of types) {
      const option = typeSelect.createEl('option', { value: type.value, text: type.label });
      if (type.value === suggestion.suggestedType) {
        option.selected = true;
      }
    }

    const synthesizeBtn = actions.createEl('button', { text: '합성하기', cls: 'mod-cta' });
    synthesizeBtn.addEventListener('click', async () => {
      const selectedType = typeSelect.value as SynthesisType;
      await this.synthesize(suggestion, selectedType);
    });
  }

  private getPriorityIcon(priority: string): string {
    switch (priority) {
      case 'high':
        return 'star';
      case 'medium':
        return 'circle';
      default:
        return 'circle-dot';
    }
  }

  async loadSuggestions(): Promise<void> {
    if (!this.plugin.suggestSynthesisUseCase) {
      new Notice('서비스가 초기화되지 않았습니다.');
      return;
    }

    this.isLoading = true;
    await this.render();

    try {
      // 현재 열린 파일 및 몇 가지 파일 ID 가져오기
      const activeFile = this.app.workspace.getActiveFile();
      const recentNoteIds: string[] = [];

      if (activeFile) {
        recentNoteIds.push(activeFile.basename);
      }

      // 추가로 몇 개의 마크다운 파일을 가져옴
      const mdFiles = this.app.vault.getMarkdownFiles().slice(0, 5);
      for (const file of mdFiles) {
        if (!recentNoteIds.includes(file.basename)) {
          recentNoteIds.push(file.basename);
        }
      }

      this.suggestions = await this.plugin.suggestSynthesisUseCase.suggestAll(recentNoteIds, {
        minClusterSize: this.plugin.settings.clusterOptions.minClusterSize,
        minCoherence: this.plugin.settings.clusterOptions.minCoherence,
        maxSuggestions: this.plugin.settings.clusterOptions.maxSuggestions,
      });
    } catch (error) {
      console.error('Failed to load suggestions:', error);
      new Notice('추천 로드 실패: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      this.isLoading = false;
      await this.render();
    }
  }

  private async synthesize(suggestion: SynthesisSuggestion, type: SynthesisType): Promise<void> {
    if (!this.plugin.synthesizeNotesUseCase) {
      new Notice('서비스가 초기화되지 않았습니다.');
      return;
    }

    new Notice('합성 중...');

    try {
      const { result } = await this.plugin.synthesizeNotesUseCase.execute({
        cluster: suggestion.cluster,
        synthesisType: type,
        options: this.plugin.settings.defaultSynthesisOptions,
      });

      // 결과 저장
      const filePath = await this.plugin.synthesizeNotesUseCase.saveResult(
        result,
        this.plugin.settings.outputFolder
      );

      new Notice(`합성 완료: ${result.title}`);

      // 생성된 파일 열기
      const file = this.app.vault.getFileByPath(filePath);
      if (file) {
        await this.app.workspace.getLeaf().openFile(file);
      }
    } catch (error) {
      console.error('Synthesis failed:', error);
      new Notice('합성 실패: ' + (error instanceof Error ? error.message : String(error)));
    }
  }
}
