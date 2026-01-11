/**
 * Settings Tab
 * Plugin settings tab UI
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

    containerEl.createEl('h2', { text: 'Knowledge Synthesizer Settings' });

    // AI Settings Section
    this.displayAISettings(containerEl);

    // Output Settings
    containerEl.createEl('h3', { text: 'Output Settings' });

    new Setting(containerEl)
      .setName('Output Folder')
      .setDesc('Folder to save synthesized notes')
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
      .setName('Excluded Folders')
      .setDesc('Folders to exclude from synthesis suggestions (comma-separated, e.g., 06_Meta, Templates)')
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
    containerEl.createEl('h3', { text: 'Synthesis Options' });

    new Setting(containerEl)
      .setName('Include Backlinks')
      .setDesc('Include links to source notes in the synthesized note')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.defaultSynthesisOptions.includeBacklinks)
          .onChange(async (value) => {
            this.plugin.settings.defaultSynthesisOptions.includeBacklinks = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Auto-suggest Tags')
      .setDesc('Analyze tags from source notes and suggest tags for the synthesis note')
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
      .setDesc('Default language for synthesis output')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('ko', 'Korean')
          .addOption('en', 'English')
          .setValue(this.plugin.settings.defaultSynthesisOptions.language)
          .onChange(async (value) => {
            this.plugin.settings.defaultSynthesisOptions.language = value as 'ko' | 'en';
            await this.plugin.saveSettings();
          })
      );

    // Cluster Options
    containerEl.createEl('h3', { text: 'Clustering Options' });

    new Setting(containerEl)
      .setName('Minimum Cluster Size')
      .setDesc('Minimum number of notes to recommend synthesis')
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
      .setDesc('Minimum coherence score for clusters (0.0 - 1.0)')
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
      .setName('Maximum Suggestions')
      .setDesc('Maximum number of synthesis suggestions to display at once')
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
    containerEl.createEl('h3', { text: 'About' });

    const aboutEl = containerEl.createDiv({ cls: 'setting-item' });
    aboutEl.createEl('p', {
      text: `Knowledge Synthesizer v${this.plugin.manifest.version}`,
      cls: 'setting-item-description',
    });
    aboutEl.createEl('p', {
      text: 'Synthesizes related notes with AI to generate higher-level insight notes.',
      cls: 'setting-item-description',
    });
    aboutEl.createEl('p', {
      text: 'Semantic search uses embedding data from the Vault Embeddings plugin.',
      cls: 'setting-item-description',
    });
  }

  private displayAISettings(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'AI Settings' });

    const currentProvider = this.plugin.settings.ai.provider;
    const currentProviderConfig = AI_PROVIDERS[currentProvider];

    // Provider selection
    new Setting(containerEl)
      .setName('AI Provider')
      .setDesc('Select the AI service to use')
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
      .setName(`${currentProviderConfig.displayName} API Key`)
      .setDesc(this.getApiKeyDescription(currentProvider))
      .addText((text) => {
        text
          .setPlaceholder('Enter API key')
          .setValue(this.plugin.settings.ai.apiKeys[currentProvider] ?? '')
          .onChange(async (value) => {
            this.plugin.settings.ai.apiKeys[currentProvider] = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.type = 'password';
        text.inputEl.style.width = '300px';
      })
      .addButton((button) => {
        button.setButtonText('Test').onClick(async () => {
          const apiKey = this.plugin.settings.ai.apiKeys[currentProvider];

          if (!apiKey) {
            new Notice('Please enter an API key first.');
            return;
          }

          button.setDisabled(true);
          button.setButtonText('Testing...');

          try {
            const isValid = await this.plugin.testApiKey(currentProvider, apiKey);
            if (isValid) {
              new Notice(`✅ ${currentProviderConfig.displayName} API key is valid!`);
            } else {
              new Notice(`❌ ${currentProviderConfig.displayName} API key is invalid.`);
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            new Notice(`❌ Test failed: ${message}`);
          } finally {
            button.setDisabled(false);
            button.setButtonText('Test');
          }
        });
      });

    // Model selection
    new Setting(containerEl)
      .setName('Model')
      .setDesc('Select the model to use')
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

    // OpenAI API Key for embeddings (separate - only shown when current provider is not OpenAI)
    if (currentProvider !== 'openai') {
      new Setting(containerEl)
        .setName('OpenAI API Key (Embeddings Only)')
        .setDesc('OpenAI API key for semantic search')
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

    // Vault Embeddings integration info
    const infoEl = containerEl.createDiv({ cls: 'setting-item-description' });
    infoEl.style.marginTop = '15px';
    infoEl.style.padding = '10px';
    infoEl.style.backgroundColor = 'var(--background-secondary)';
    infoEl.style.borderRadius = '5px';
    infoEl.innerHTML = `
      <p style="margin: 0 0 5px 0;"><strong>📦 Vault Embeddings Integration</strong></p>
      <p style="margin: 0; font-size: 0.9em;">Note embeddings are managed by the <strong>Vault Embeddings</strong> plugin.<br>
      To use semantic clustering, run "Embed All Notes" in Vault Embeddings first.</p>
    `;

    // Note about embedding
    const noteEl = containerEl.createDiv({ cls: 'setting-item-description' });
    noteEl.style.marginTop = '10px';
    noteEl.style.fontStyle = 'italic';
    noteEl.innerHTML =
      '※ Semantic clustering requires an OpenAI API key (for query embeddings). Tag/folder-based clustering works without an API key.';
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
        return 'Get your API key from https://console.anthropic.com';
      case 'openai':
        return 'Get your API key from https://platform.openai.com';
      case 'gemini':
        return 'Get your API key from https://aistudio.google.com';
      case 'grok':
        return 'Get your API key from https://console.x.ai';
      default:
        return 'Enter your API key.';
    }
  }
}
