/**
 * Synthesis View
 * Synthesis sidebar view
 */

import { ItemView, WorkspaceLeaf, Notice, setIcon } from 'obsidian';
import type KnowledgeSynthesizerPlugin from '../main';
import type { SynthesisSuggestion } from '../core/application/use-cases/suggest-synthesis';
import type { SynthesisType } from '../core/domain/entities/synthesis-request';
import { generateNoteId } from '../core/domain/utils/note-id';

export const SYNTHESIS_VIEW_TYPE = 'knowledge-synthesizer-view';

export class SynthesisView extends ItemView {
  private plugin: KnowledgeSynthesizerPlugin;
  private suggestions: SynthesisSuggestion[] = [];
  private isLoading = false;
  private loadingMessage = '';
  private loadingStage = '';

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
    // Cleanup
  }

  private async render(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('synthesis-view-container');

    // Header
    const header = container.createDiv({ cls: 'synthesis-view-header' });
    header.createEl('h4', { text: 'Knowledge Synthesizer' });

    // API key check
    if (!this.plugin.isConfigured()) {
      const warning = container.createDiv({ cls: 'synthesis-warning' });
      warning.createEl('p', { text: '⚠️ API key not configured.' });
      warning.createEl('p', { text: 'Please enter your API key in settings.' });
      return;
    }

    // Refresh button
    const actions = container.createDiv({ cls: 'synthesis-actions' });
    const refreshBtn = actions.createEl('button', { text: 'Refresh Suggestions' });
    refreshBtn.addEventListener('click', () => this.loadSuggestions());

    // Loading state
    if (this.isLoading) {
      const loading = container.createDiv({ cls: 'synthesis-loading' });
      loading.createDiv({ cls: 'synthesis-loading-spinner' });
      loading.createEl('p', { text: this.loadingMessage || 'Analyzing...', cls: 'synthesis-loading-text' });
      if (this.loadingStage) {
        loading.createEl('p', { text: this.loadingStage, cls: 'synthesis-loading-stage' });
      }
      return;
    }

    // Suggestions list
    if (this.suggestions.length === 0) {
      const empty = container.createDiv({ cls: 'synthesis-empty' });
      empty.createEl('p', { text: 'No synthesizable clusters found.' });
      empty.createEl('p', { text: 'Try adding more notes or using tags.' });
      return;
    }

    const suggestionList = container.createDiv({ cls: 'synthesis-suggestions' });

    for (const suggestion of this.suggestions) {
      this.renderSuggestion(suggestionList, suggestion);
    }
  }

  private renderSuggestion(container: HTMLElement, suggestion: SynthesisSuggestion): void {
    const card = container.createDiv({ cls: 'synthesis-suggestion-card' });

    // Header
    const cardHeader = card.createDiv({ cls: 'suggestion-header' });

    const priorityIcon = cardHeader.createSpan({ cls: `priority-icon priority-${suggestion.priority}` });
    setIcon(priorityIcon, this.getPriorityIcon(suggestion.priority));

    cardHeader.createEl('span', { text: suggestion.cluster.name, cls: 'suggestion-title' });

    // Info
    const info = card.createDiv({ cls: 'suggestion-info' });
    info.createEl('span', { text: `${suggestion.cluster.members.length} notes` });
    info.createEl('span', { text: `Coherence: ${(suggestion.cluster.coherenceScore * 100).toFixed(0)}%` });

    // Reason
    card.createEl('p', { text: suggestion.reason, cls: 'suggestion-reason' });

    // Note list (collapsible)
    const noteList = card.createDiv({ cls: 'suggestion-notes' });
    const toggleBtn = noteList.createEl('button', { text: 'Show Notes', cls: 'toggle-notes' });
    const noteListContent = noteList.createDiv({ cls: 'note-list-content hidden' });

    for (const member of suggestion.cluster.members.slice(0, 10)) {
      noteListContent.createEl('div', { text: `• ${member.title}`, cls: 'note-item' });
    }
    if (suggestion.cluster.members.length > 10) {
      noteListContent.createEl('div', {
        text: `... and ${suggestion.cluster.members.length - 10} more`,
        cls: 'note-item more',
      });
    }

    toggleBtn.addEventListener('click', () => {
      noteListContent.classList.toggle('hidden');
      toggleBtn.textContent = noteListContent.classList.contains('hidden')
        ? 'Show Notes'
        : 'Hide Notes';
    });

    // Synthesis button
    const actions = card.createDiv({ cls: 'suggestion-actions' });

    const typeSelect = actions.createEl('select', { cls: 'synthesis-type-select' });
    const types: { value: SynthesisType; label: string }[] = [
      { value: 'framework', label: 'Comprehensive Framework' },
      { value: 'summary', label: 'Summary' },
      { value: 'comparison', label: 'Comparative Analysis' },
      { value: 'timeline', label: 'Timeline' },
    ];
    for (const type of types) {
      const option = typeSelect.createEl('option', { value: type.value, text: type.label });
      if (type.value === suggestion.suggestedType) {
        option.selected = true;
      }
    }

    const synthesizeBtn = actions.createEl('button', { text: 'Synthesize', cls: 'mod-cta' });
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
      new Notice('Service not initialized.');
      return;
    }

    this.isLoading = true;
    this.loadingMessage = 'Analyzing notes...';
    this.loadingStage = 'Collecting related notes';
    await this.render();

    try {
      // Get current file and some file IDs (hash-based - Vault Embeddings compatible)
      const activeFile = this.app.workspace.getActiveFile();
      const recentNoteIds: string[] = [];

      if (activeFile) {
        recentNoteIds.push(generateNoteId(activeFile.path));
      }

      // Get a few additional markdown files
      const mdFiles = this.app.vault.getMarkdownFiles().slice(0, 5);
      for (const file of mdFiles) {
        const noteId = generateNoteId(file.path);
        if (!recentNoteIds.includes(noteId)) {
          recentNoteIds.push(noteId);
        }
      }

      // Update loading message
      this.loadingMessage = 'Analyzing clusters...';
      this.loadingStage = 'Grouping by tags and folders';
      await this.render();

      this.suggestions = await this.plugin.suggestSynthesisUseCase.suggestAll(recentNoteIds, {
        minClusterSize: this.plugin.settings.clusterOptions.minClusterSize,
        minCoherence: this.plugin.settings.clusterOptions.minCoherence,
        maxSuggestions: this.plugin.settings.clusterOptions.maxSuggestions,
        excludedFolders: this.plugin.settings.excludedFolders,
      });
    } catch (error) {
      console.error('Failed to load suggestions:', error);
      new Notice('Failed to load suggestions: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      this.isLoading = false;
      this.loadingMessage = '';
      this.loadingStage = '';
      await this.render();
    }
  }

  private async synthesize(suggestion: SynthesisSuggestion, type: SynthesisType): Promise<void> {
    if (!this.plugin.synthesizeNotesUseCase) {
      new Notice('Service not initialized.');
      return;
    }

    new Notice('Synthesizing...');

    try {
      const { result } = await this.plugin.synthesizeNotesUseCase.execute({
        cluster: suggestion.cluster,
        synthesisType: type,
        options: this.plugin.settings.defaultSynthesisOptions,
      });

      // Save result
      const filePath = await this.plugin.synthesizeNotesUseCase.saveResult(
        result,
        this.plugin.settings.outputFolder
      );

      new Notice(`Synthesis complete: ${result.title}`);

      // Open the generated file
      const file = this.app.vault.getFileByPath(filePath);
      if (file) {
        await this.app.workspace.getLeaf().openFile(file);
      }
    } catch (error) {
      console.error('Synthesis failed:', error);
      new Notice('Synthesis failed: ' + (error instanceof Error ? error.message : String(error)));
    }
  }
}
