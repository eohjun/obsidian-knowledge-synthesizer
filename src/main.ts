/**
 * Knowledge Synthesizer Plugin
 * 관련 노트들을 AI로 합성하여 상위 인사이트 노트 생성
 */

import { Plugin } from 'obsidian';

// Domain
import type { IEmbeddingProvider } from './core/domain/interfaces/embedding-provider.interface';
import type { IVectorStore } from './core/domain/interfaces/vector-store.interface';
import type { ISynthesisGenerator } from './core/domain/interfaces/synthesis-generator.interface';
import type { INoteRepository } from './core/domain/interfaces/note-repository.interface';
import { AIProviderType, AI_PROVIDERS } from './core/domain/constants';

// Application
import { EmbeddingService } from './core/application/services/embedding-service';
import { ClusterNotesUseCase } from './core/application/use-cases/cluster-notes';
import { SynthesizeNotesUseCase } from './core/application/use-cases/synthesize-notes';
import { SuggestSynthesisUseCase } from './core/application/use-cases/suggest-synthesis';

// Adapters
import { OpenAIEmbeddingProvider } from './adapters/embedding/openai-embedding-provider';
import { InMemoryVectorStore } from './adapters/embedding/in-memory-vector-store';
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
  private vectorStore: IVectorStore | null = null;
  private synthesisGenerator: LLMSynthesisGenerator | null = null;
  private noteRepository: INoteRepository | null = null;
  private embeddingService: EmbeddingService | null = null;

  // Use Cases
  private clusterNotesUseCase: ClusterNotesUseCase | null = null;
  synthesizeNotesUseCase: SynthesizeNotesUseCase | null = null;
  suggestSynthesisUseCase: SuggestSynthesisUseCase | null = null;

  async onload(): Promise<void> {
    console.log('Loading Knowledge Synthesizer Plugin');

    // 설정 로드
    await this.loadSettings();

    // 서비스 초기화
    this.initializeServices();

    // 뷰 등록
    this.registerView(SYNTHESIS_VIEW_TYPE, (leaf) => new SynthesisView(leaf, this));

    // 명령어 등록
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

    // 설정 탭 등록
    this.addSettingTab(new KnowledgeSynthesizerSettingTab(this.app, this));

    // 리본 아이콘
    this.addRibbonIcon('layers', 'Knowledge Synthesizer', () => this.activateView());
  }

  async onunload(): Promise<void> {
    console.log('Unloading Knowledge Synthesizer Plugin');
    // 벡터 스토어 정리
    this.vectorStore?.clear();
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    // 이전 설정과의 호환성 처리
    this.migrateSettings();
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    // 서비스 재초기화
    this.initializeServices();
  }

  /**
   * 이전 설정에서 새 설정으로 마이그레이션
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
   * 플러그인이 올바르게 설정되었는지 확인
   */
  isConfigured(): boolean {
    const currentProvider = this.settings.ai.provider;
    const apiKey = this.settings.ai.apiKeys[currentProvider];
    return !!apiKey;
  }

  /**
   * API 키 테스트
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
   * 서비스 초기화
   */
  private initializeServices(): void {
    const currentProvider = this.settings.ai.provider;
    const llmApiKey = this.settings.ai.apiKeys[currentProvider];

    // LLM API 키가 없으면 합성 서비스 초기화하지 않음
    if (!llmApiKey) {
      console.log('Knowledge Synthesizer: LLM API key not configured');
      return;
    }

    try {
      // Note Repository (항상 필요)
      this.noteRepository = new ObsidianNoteRepository(this.app);

      // Embedding Provider & Vector Store (OpenAI API 키 필요)
      const openaiApiKey = this.settings.ai.apiKeys.openai;
      if (openaiApiKey) {
        this.embeddingProvider = new OpenAIEmbeddingProvider(openaiApiKey);
        this.vectorStore = new InMemoryVectorStore();
        this.embeddingService = new EmbeddingService(this.embeddingProvider, this.vectorStore);
      } else {
        console.log('Knowledge Synthesizer: OpenAI API key not configured for embeddings');
        this.embeddingProvider = null;
        this.vectorStore = null;
        this.embeddingService = null;
      }

      // Synthesis Generator
      const llmConfig: LLMConfig = {
        provider: currentProvider,
        apiKey: llmApiKey,
        model: this.settings.ai.models[currentProvider],
      };
      this.synthesisGenerator = new LLMSynthesisGenerator(llmConfig);

      // Use Cases (embeddingService가 있을 때만 ClusterNotesUseCase 생성)
      if (this.embeddingService) {
        this.clusterNotesUseCase = new ClusterNotesUseCase(
          this.embeddingService,
          this.noteRepository
        );
        // 제외 폴더 설정
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
   * 합성 뷰 활성화
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

      // 뷰가 열리면 추천 로드
      const view = leaf.view;
      if (view instanceof SynthesisView) {
        await view.loadSuggestions();
      }
    }
  }

  /**
   * 현재 노트의 주요 태그로 합성
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

    // 첫 번째 태그 사용
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
