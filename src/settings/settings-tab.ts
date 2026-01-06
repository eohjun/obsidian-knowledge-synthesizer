/**
 * Settings Tab
 * 설정 탭 UI
 */

import { App, PluginSettingTab, Setting } from 'obsidian';
import type KnowledgeSynthesizerPlugin from '../main';

export class KnowledgeSynthesizerSettingTab extends PluginSettingTab {
  plugin: KnowledgeSynthesizerPlugin;

  constructor(app: App, plugin: KnowledgeSynthesizerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Knowledge Synthesizer Settings' });

    // API Keys Section
    containerEl.createEl('h3', { text: 'API Keys' });

    new Setting(containerEl)
      .setName('OpenAI API Key')
      .setDesc('임베딩 및 합성에 사용되는 OpenAI API 키')
      .addText((text) =>
        text
          .setPlaceholder('sk-...')
          .setValue(this.plugin.settings.openaiApiKey)
          .onChange(async (value) => {
            this.plugin.settings.openaiApiKey = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Anthropic API Key')
      .setDesc('Claude를 사용한 합성용 Anthropic API 키')
      .addText((text) =>
        text
          .setPlaceholder('sk-ant-...')
          .setValue(this.plugin.settings.anthropicApiKey)
          .onChange(async (value) => {
            this.plugin.settings.anthropicApiKey = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('LLM Provider')
      .setDesc('합성에 사용할 LLM 프로바이더')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('openai', 'OpenAI')
          .addOption('anthropic', 'Anthropic (Claude)')
          .setValue(this.plugin.settings.llmProvider)
          .onChange(async (value) => {
            this.plugin.settings.llmProvider = value as 'openai' | 'anthropic';
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Model')
      .setDesc('사용할 모델 (비워두면 기본값 사용)')
      .addText((text) =>
        text
          .setPlaceholder('gpt-4o-mini 또는 claude-3-5-haiku-latest')
          .setValue(this.plugin.settings.model || '')
          .onChange(async (value) => {
            this.plugin.settings.model = value || undefined;
            await this.plugin.saveSettings();
          })
      );

    // Output Section
    containerEl.createEl('h3', { text: 'Output' });

    new Setting(containerEl)
      .setName('Output Folder')
      .setDesc('합성된 노트가 저장될 폴더')
      .addText((text) =>
        text
          .setPlaceholder('Synthesized')
          .setValue(this.plugin.settings.outputFolder)
          .onChange(async (value) => {
            this.plugin.settings.outputFolder = value;
            await this.plugin.saveSettings();
          })
      );

    // Synthesis Options Section
    containerEl.createEl('h3', { text: 'Synthesis Options' });

    new Setting(containerEl)
      .setName('Include Backlinks')
      .setDesc('합성 결과에 원본 노트로의 역링크 포함')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.defaultSynthesisOptions.includeBacklinks)
          .onChange(async (value) => {
            this.plugin.settings.defaultSynthesisOptions.includeBacklinks = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Auto Suggest Tags')
      .setDesc('AI가 자동으로 태그 제안')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.defaultSynthesisOptions.autoSuggestTags)
          .onChange(async (value) => {
            this.plugin.settings.defaultSynthesisOptions.autoSuggestTags = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Default Language')
      .setDesc('생성되는 노트의 기본 언어')
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

    // Cluster Options Section
    containerEl.createEl('h3', { text: 'Cluster Options' });

    new Setting(containerEl)
      .setName('Minimum Cluster Size')
      .setDesc('합성 추천에 필요한 최소 노트 수')
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
      .setName('Minimum Coherence')
      .setDesc('합성 추천에 필요한 최소 응집도 (0.0 - 1.0)')
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
      .setName('Max Suggestions')
      .setDesc('표시할 최대 추천 수')
      .addSlider((slider) =>
        slider
          .setLimits(3, 15, 1)
          .setValue(this.plugin.settings.clusterOptions.maxSuggestions)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.clusterOptions.maxSuggestions = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
