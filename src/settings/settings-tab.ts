/**
 * Settings Tab
 * 플러그인 설정 탭 UI
 */

import { App, PluginSettingTab, Setting, Notice, DropdownComponent } from 'obsidian';
import type KnowledgeSynthesizerPlugin from '../main';
import { AIProviderType, AI_PROVIDERS, getModelsByProvider } from '../core/domain/constants';

export class KnowledgeSynthesizerSettingTab extends PluginSettingTab {
  plugin: KnowledgeSynthesizerPlugin;
  private modelDropdown: DropdownComponent | null = null;

  constructor(app: App, plugin: KnowledgeSynthesizerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Knowledge Synthesizer 설정' });

    // AI Settings Section
    this.displayAISettings(containerEl);

    // Output Settings
    containerEl.createEl('h3', { text: '출력 설정' });

    new Setting(containerEl)
      .setName('출력 폴더')
      .setDesc('합성된 노트를 저장할 폴더')
      .addText((text) =>
        text
          .setPlaceholder('Synthesized')
          .setValue(this.plugin.settings.outputFolder)
          .onChange(async (value) => {
            this.plugin.settings.outputFolder = value || 'Synthesized';
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('제외 폴더')
      .setDesc('합성 추천에서 제외할 폴더 (쉼표로 구분, 예: 06_Meta, Templates)')
      .addText((text) =>
        text
          .setPlaceholder('06_Meta, Templates')
          .setValue(this.plugin.settings.excludedFolders.join(', '))
          .onChange(async (value) => {
            this.plugin.settings.excludedFolders = value
              .split(',')
              .map(f => f.trim())
              .filter(f => f.length > 0);
            await this.plugin.saveSettings();
          })
      );

    // Synthesis Options
    containerEl.createEl('h3', { text: '합성 옵션' });

    new Setting(containerEl)
      .setName('역링크 포함')
      .setDesc('합성된 노트에 원본 노트로의 링크를 포함합니다')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.defaultSynthesisOptions.includeBacklinks)
          .onChange(async (value) => {
            this.plugin.settings.defaultSynthesisOptions.includeBacklinks = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('자동 태그 제안')
      .setDesc('원본 노트들의 태그를 분석하여 합성 노트에 태그를 제안합니다')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.defaultSynthesisOptions.autoSuggestTags)
          .onChange(async (value) => {
            this.plugin.settings.defaultSynthesisOptions.autoSuggestTags = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('기본 언어')
      .setDesc('합성 결과의 기본 언어')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('ko', '한국어')
          .addOption('en', 'English')
          .setValue(this.plugin.settings.defaultSynthesisOptions.language)
          .onChange(async (value) => {
            this.plugin.settings.defaultSynthesisOptions.language = value as 'ko' | 'en';
            await this.plugin.saveSettings();
          })
      );

    // Cluster Options
    containerEl.createEl('h3', { text: '클러스터링 옵션' });

    new Setting(containerEl)
      .setName('최소 클러스터 크기')
      .setDesc('합성을 추천할 최소 노트 수')
      .addSlider((slider) =>
        slider
          .setLimits(2, 10, 1)
          .setValue(this.plugin.settings.clusterOptions.minClusterSize)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.clusterOptions.minClusterSize = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('최소 응집도')
      .setDesc('클러스터의 최소 응집도 (0.0 ~ 1.0)')
      .addSlider((slider) =>
        slider
          .setLimits(0.1, 0.9, 0.1)
          .setValue(this.plugin.settings.clusterOptions.minCoherence)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.clusterOptions.minCoherence = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('최대 추천 수')
      .setDesc('한 번에 표시할 최대 합성 추천 수')
      .addSlider((slider) =>
        slider
          .setLimits(3, 20, 1)
          .setValue(this.plugin.settings.clusterOptions.maxSuggestions)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.clusterOptions.maxSuggestions = value;
            await this.plugin.saveSettings();
          })
      );

    // About Section
    containerEl.createEl('h3', { text: '정보' });

    const aboutEl = containerEl.createDiv({ cls: 'setting-item' });
    aboutEl.createEl('p', {
      text: 'Knowledge Synthesizer v0.3.0',
      cls: 'setting-item-description',
    });
    aboutEl.createEl('p', {
      text: '관련 노트들을 AI로 합성하여 상위 인사이트 노트를 생성합니다.',
      cls: 'setting-item-description',
    });
    aboutEl.createEl('p', {
      text: '의미 검색은 Vault Embeddings 플러그인의 임베딩 데이터를 사용합니다.',
      cls: 'setting-item-description',
    });
  }

  private displayAISettings(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'AI 설정' });

    const currentProvider = this.plugin.settings.ai.provider;
    const currentProviderConfig = AI_PROVIDERS[currentProvider];

    // Provider selection
    new Setting(containerEl)
      .setName('AI 프로바이더')
      .setDesc('사용할 AI 서비스를 선택하세요')
      .addDropdown((dropdown) => {
        Object.entries(AI_PROVIDERS).forEach(([key, config]) => {
          dropdown.addOption(key, config.displayName);
        });
        dropdown.setValue(currentProvider);
        dropdown.onChange(async (value) => {
          this.plugin.settings.ai.provider = value as AIProviderType;
          await this.plugin.saveSettings();
          this.display(); // Refresh to update model dropdown
        });
      });

    // API Key input with Test button
    new Setting(containerEl)
      .setName(`${currentProviderConfig.displayName} API 키`)
      .setDesc(this.getApiKeyDescription(currentProvider))
      .addText((text) => {
        text
          .setPlaceholder('API 키 입력')
          .setValue(this.plugin.settings.ai.apiKeys[currentProvider] ?? '')
          .onChange(async (value) => {
            this.plugin.settings.ai.apiKeys[currentProvider] = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.type = 'password';
        text.inputEl.style.width = '300px';
      })
      .addButton((button) => {
        button.setButtonText('테스트').onClick(async () => {
          const apiKey = this.plugin.settings.ai.apiKeys[currentProvider];

          if (!apiKey) {
            new Notice('API 키를 먼저 입력해주세요.');
            return;
          }

          button.setDisabled(true);
          button.setButtonText('테스트 중...');

          try {
            const isValid = await this.plugin.testApiKey(currentProvider, apiKey);
            if (isValid) {
              new Notice(`✅ ${currentProviderConfig.displayName} API 키가 유효합니다!`);
            } else {
              new Notice(`❌ ${currentProviderConfig.displayName} API 키가 유효하지 않습니다.`);
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : '알 수 없는 오류';
            new Notice(`❌ 테스트 실패: ${message}`);
          } finally {
            button.setDisabled(false);
            button.setButtonText('테스트');
          }
        });
      });

    // Model selection
    new Setting(containerEl)
      .setName('모델')
      .setDesc('사용할 모델을 선택하세요')
      .addDropdown((dropdown) => {
        this.modelDropdown = dropdown;
        this.populateModelDropdown(dropdown, currentProvider);
        dropdown.setValue(
          this.plugin.settings.ai.models[currentProvider] ?? currentProviderConfig.defaultModel
        );
        dropdown.onChange(async (value) => {
          this.plugin.settings.ai.models[currentProvider] = value;
          await this.plugin.saveSettings();
        });
      });

    // OpenAI API Key for embeddings (별도 - 현재 프로바이더가 OpenAI가 아닌 경우만 표시)
    if (currentProvider !== 'openai') {
      new Setting(containerEl)
        .setName('OpenAI API 키 (임베딩 전용)')
        .setDesc('의미 기반 검색에 사용할 OpenAI API 키')
        .addText((text) => {
          text
            .setPlaceholder('sk-...')
            .setValue(this.plugin.settings.ai.apiKeys['openai'] ?? '')
            .onChange(async (value) => {
              this.plugin.settings.ai.apiKeys['openai'] = value;
              await this.plugin.saveSettings();
            });
          text.inputEl.type = 'password';
          text.inputEl.style.width = '300px';
        });
    }

    // Vault Embeddings 연동 안내
    const infoEl = containerEl.createDiv({ cls: 'setting-item-description' });
    infoEl.style.marginTop = '15px';
    infoEl.style.padding = '10px';
    infoEl.style.backgroundColor = 'var(--background-secondary)';
    infoEl.style.borderRadius = '5px';
    infoEl.innerHTML = `
      <p style="margin: 0 0 5px 0;"><strong>📦 Vault Embeddings 연동</strong></p>
      <p style="margin: 0; font-size: 0.9em;">노트 임베딩은 <strong>Vault Embeddings</strong> 플러그인이 관리합니다.<br>
      의미 기반 클러스터링을 사용하려면 Vault Embeddings에서 "Embed All Notes"를 먼저 실행하세요.</p>
    `;

    // Note about embedding
    const noteEl = containerEl.createDiv({ cls: 'setting-item-description' });
    noteEl.style.marginTop = '10px';
    noteEl.style.fontStyle = 'italic';
    noteEl.innerHTML =
      '※ 의미 기반 클러스터링에는 OpenAI API 키가 필요합니다 (검색 쿼리 임베딩용). 태그/폴더 기반 클러스터링은 API 키 없이도 작동합니다.';
  }

  private populateModelDropdown(dropdown: DropdownComponent, provider: AIProviderType): void {
    const models = getModelsByProvider(provider);
    models.forEach((model) => {
      dropdown.addOption(model.id, model.displayName);
    });
  }

  private getApiKeyDescription(provider: AIProviderType): string {
    switch (provider) {
      case 'claude':
        return 'https://console.anthropic.com 에서 발급받을 수 있습니다.';
      case 'openai':
        return 'https://platform.openai.com 에서 발급받을 수 있습니다.';
      case 'gemini':
        return 'https://aistudio.google.com 에서 발급받을 수 있습니다.';
      case 'grok':
        return 'https://console.x.ai 에서 발급받을 수 있습니다.';
      default:
        return 'API 키를 입력하세요.';
    }
  }
}
