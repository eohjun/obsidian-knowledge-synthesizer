/**
 * Knowledge Synthesizer Plugin
 * Synthesizes related notes with AI to generate higher-level insight notes
 */

import { Plugin } from 'obsidian';

// Domain
import type { IEmbeddingProvider } from './core/domain/interfaces/embedding-provider.interface';
import type { INoteRepository } from './core/domain/interfaces/note-repository.interface';
import { AIProviderType, AI_PROVIDERS } from './core/domain/constants';

// Application
import { EmbeddingService } from './core/application/services/embedding-service';
import { ClusterNotesUseCase } from './core/application/use-cases/cluster-notes';
import { SynthesizeNotesUseCase } from './core/application/use-cases/synthesize-notes';
import { SuggestSynthesisUseCase } from './core/application/use-cases/suggest-synthesis';

// Adapters
import { OpenAIEmbeddingProvider } from './adapters/embedding/openai-embedding-provider';
import { VaultEmbeddingsVectorStore } from './adapters/embedding/vault-embeddings-vector-store';
import { LLMSynthesisGenerator, LLMConfig } from './adapters/llm/llm-synthesis-generator';
import { ObsidianNoteRepository } from './adapters/obsidian/obsidian-note-repository';

// Settings
import { KnowledgeSynthesizerSettings, DEFAULT_SETTINGS } from './settings/settings';
import { KnowledgeSynthesizerSettingTab } from './settings/settings-tab';

// Views
import { SynthesisView, SYNTHESIS_VIEW_TYPE } from './views/synthesis-view';

export default class KnowledgeSynthesizerPlugin extends Plugin {
  settings!: KnowledgeSynthesizerSettings;

  // Services
  private embeddingProvider: IEmbeddingProvider | null = null;
  private vectorStore: VaultEmbeddingsVectorStore | null = null;
  private synthesisGenerator: LLMSynthesisGenerator | null = null;
  private noteRepository: INoteRepository | null = null;
  private embeddingService: EmbeddingService | null = null;

  // Use Cases
  private clusterNotesUseCase: ClusterNotesUseCase | null = null;
  synthesizeNotesUseCase: SynthesizeNotesUseCase | null = null;
  suggestSynthesisUseCase: SuggestSynthesisUseCase | null = null;

  async onload(): Promise<void> {
    console.log('Loading Knowledge Synthesizer Plugin');

    // Load settings
    await this.loadSettings();

    // Initialize services
    await this.initializeServices();

    // Register view
    this.registerView(SYNTHESIS_VIEW_TYPE, (leaf) => new SynthesisView(leaf, this));

    // Register commands
    this.addCommand({
      id: 'open-synthesis-view',
      name: 'Open Synthesis View',
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: 'synthesize-current-tag',
      name: 'Synthesize notes with current note\'s primary tag',
      callback: () => this.synthesizeCurrentTag(),
    });

    // Register settings tab
    this.addSettingTab(new KnowledgeSynthesizerSettingTab(this.app, this));

    // Ribbon icon
    this.addRibbonIcon('layers', 'Knowledge Synthesizer', () => this.activateView());
  }

  async onunload(): Promise<void> {
    console.log('Unloading Knowledge Synthesizer Plugin');
    // Clean up vector store
    this.vectorStore?.clear();
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    // Handle compatibility with previous settings
    this.migrateSettings();
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    // Reinitialize services
    await this.initializeServices();
  }

  /**
   * Migrate from previous settings to new settings format
   */
  private migrateSettings(): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const oldSettings = this.settings as any;

    // openaiApiKey → ai.apiKeys.openai
    if (oldSettings.openaiApiKey && !this.settings.ai.apiKeys.openai) {
      this.settings.ai.apiKeys.openai = oldSettings.openaiApiKey;
      delete oldSettings.openaiApiKey;
    }

    // anthropicApiKey → ai.apiKeys.claude
    if (oldSettings.anthropicApiKey && !this.settings.ai.apiKeys.claude) {
      this.settings.ai.apiKeys.claude = oldSettings.anthropicApiKey;
      delete oldSettings.anthropicApiKey;
    }

    // llmProvider → ai.provider (openai/anthropic → openai/claude)
    if (oldSettings.llmProvider) {
      if (oldSettings.llmProvider === 'anthropic') {
        this.settings.ai.provider = 'claude';
      } else if (oldSettings.llmProvider === 'openai') {
        this.settings.ai.provider = 'openai';
      }
      delete oldSettings.llmProvider;
    }

    // model → ai.models[provider]
    if (oldSettings.model) {
      const provider = this.settings.ai.provider;
      this.settings.ai.models[provider] = oldSettings.model;
      delete oldSettings.model;
    }
  }

  /**
   * Check if the plugin is properly configured
   */
  isConfigured(): boolean {
    const currentProvider = this.settings.ai.provider;
    const apiKey = this.settings.ai.apiKeys[currentProvider];
    return !!apiKey;
  }

  /**
   * Test API key validity
   */
  async testApiKey(provider: AIProviderType, apiKey: string): Promise<boolean> {
    const model = this.settings.ai.models[provider] ?? AI_PROVIDERS[provider].defaultModel;
    const testGenerator = new LLMSynthesisGenerator({
      provider,
      apiKey,
      model,
    });
    return testGenerator.testApiKey(apiKey);
  }

  /**
   * Initialize services
   */
  private async initializeServices(): Promise<void> {
    const currentProvider = this.settings.ai.provider;
    const llmApiKey = this.settings.ai.apiKeys[currentProvider];

    // Don't initialize synthesis service if LLM API key is missing
    if (!llmApiKey) {
      console.log('Knowledge Synthesizer: LLM API key not configured');
      return;
    }

    try {
      // Note Repository (always required)
      this.noteRepository = new ObsidianNoteRepository(this.app);

      // Embedding Provider (for query embeddings - requires OpenAI API key)
      const openaiApiKey = this.settings.ai.apiKeys.openai;
      if (openaiApiKey) {
        this.embeddingProvider = new OpenAIEmbeddingProvider(openaiApiKey);
      } else {
        console.log('Knowledge Synthesizer: OpenAI API key not configured for query embeddings');
        this.embeddingProvider = null;
      }

      // Vector Store (read from Vault Embeddings)
      this.vectorStore = new VaultEmbeddingsVectorStore(this.app, {
        storagePath: '09_Embedded',
        embeddingsFolder: 'embeddings',
      });
      await this.vectorStore.initialize();

      // Embedding Service (query embedding + search)
      if (this.embeddingProvider && this.vectorStore.isAvailable()) {
        this.embeddingService = new EmbeddingService(this.embeddingProvider, this.vectorStore);
        console.log(`Knowledge Synthesizer: Loaded ${this.vectorStore.size()} embeddings from Vault Embeddings`);
      } else if (!this.embeddingProvider) {
        console.log('Knowledge Synthesizer: No OpenAI API key - semantic clustering disabled');
        this.embeddingService = null;
      } else {
        console.log('Knowledge Synthesizer: No Vault Embeddings data - semantic clustering disabled');
        this.embeddingService = null;
      }

      // Synthesis Generator
      const llmConfig: LLMConfig = {
        provider: currentProvider,
        apiKey: llmApiKey,
        model: this.settings.ai.models[currentProvider],
      };
      this.synthesisGenerator = new LLMSynthesisGenerator(llmConfig);

      // Use Cases (only create ClusterNotesUseCase when embeddingService is available)
      if (this.embeddingService) {
        this.clusterNotesUseCase = new ClusterNotesUseCase(
          this.embeddingService,
          this.noteRepository
        );
        // Set excluded folders
        this.clusterNotesUseCase.setExcludedFolders(this.settings.excludedFolders);
      }

      this.synthesizeNotesUseCase = new SynthesizeNotesUseCase(
        this.synthesisGenerator,
        this.noteRepository
      );

      if (this.clusterNotesUseCase) {
        this.suggestSynthesisUseCase = new SuggestSynthesisUseCase(
          this.clusterNotesUseCase,
          this.noteRepository
        );
      }

      console.log('Knowledge Synthesizer: Services initialized');
    } catch (error) {
      console.error('Failed to initialize services:', error);
    }
  }

  /**
   * Activate synthesis view
   */
  private async activateView(): Promise<void> {
    const { workspace } = this.app;

    let leaf = workspace.getLeavesOfType(SYNTHESIS_VIEW_TYPE)[0];

    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        leaf = rightLeaf;
        await leaf.setViewState({ type: SYNTHESIS_VIEW_TYPE, active: true });
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);

      // Load suggestions when view opens
      const view = leaf.view;
      if (view instanceof SynthesisView) {
        await view.loadSuggestions();
      }
    }
  }

  /**
   * Synthesize using the current note's primary tag
   */
  private async synthesizeCurrentTag(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      return;
    }

    const cache = this.app.metadataCache.getFileCache(activeFile);
    if (!cache?.tags || cache.tags.length === 0) {
      return;
    }

    // Use the first tag
    const tag = cache.tags[0].tag.replace(/^#/, '');

    if (!this.clusterNotesUseCase || !this.synthesizeNotesUseCase) {
      return;
    }

    try {
      const cluster = await this.clusterNotesUseCase.clusterByTag(tag);

      if (cluster.members.length < 2) {
        return;
      }

      const { result } = await this.synthesizeNotesUseCase.execute({
        cluster,
        synthesisType: 'framework',
        options: this.settings.defaultSynthesisOptions,
      });

      await this.synthesizeNotesUseCase.saveResult(result, this.settings.outputFolder);
    } catch (error) {
      console.error('Failed to synthesize:', error);
    }
  }
}
