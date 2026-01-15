# Knowledge Synthesizer

An AI-powered Obsidian plugin that synthesizes related notes into higher-level frameworks and insights.

## Features

- **Auto Clustering**: Group related notes by tags, folders, or semantic similarity
- **AI Synthesis**: Generate multiple types of synthesis notes
  - **Framework**: Structured conceptual framework
  - **Summary**: Core content summary
  - **Comparison**: Compare and contrast analysis
  - **Timeline**: Historical development timeline
- **Synthesis Candidates**: Auto-suggest note clusters suitable for synthesis
- **Custom Selection**: Manually select notes to synthesize

## PKM Workflow

```
Note Cluster → Knowledge Synthesizer → Synthesis Note (Framework/Summary/Comparison/Timeline)
                    (Synthesize)
```

## Supported AI Providers

| Provider | Model | Notes |
|----------|-------|-------|
| **OpenAI** | GPT-4o, GPT-4o-mini | Structured framework generation |
| **Google Gemini** | Gemini 1.5 Pro/Flash | Long context support, free tier |
| **Anthropic** | Claude 3.5 Sonnet | Deep comparison analysis |

## Installation

### BRAT (Recommended)

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin
2. Open BRAT settings
3. Click "Add Beta plugin"
4. Enter: `eohjun/obsidian-knowledge-synthesizer`
5. Enable the plugin

### Manual

1. Download `main.js`, `manifest.json`, `styles.css` from the latest release
2. Create folder: `<vault>/.obsidian/plugins/knowledge-synthesizer/`
3. Copy downloaded files to the folder
4. Enable the plugin in Obsidian settings

## Dependencies (Optional)

- **[Vault Embeddings](https://github.com/eohjun/obsidian-vault-embeddings)**: Semantic-based clustering (recommended)

With Vault Embeddings installed, semantic similarity-based clustering becomes available.

## Setup

### API Key Configuration

1. Open Settings → Knowledge Synthesizer
2. In **AI Provider** section:
   - Select AI Provider
   - Enter API key

## Commands

| Command | Description |
|---------|-------------|
| **Synthesize selected notes** | Synthesize selected notes |
| **Synthesize by tag** | Synthesize notes with specific tag |
| **Synthesize by folder** | Synthesize notes in specific folder |
| **Show synthesis candidates** | View synthesis candidate clusters |

## Usage Workflow

```
1. Choose how to select notes for synthesis:
   - Manual: Multi-select in file explorer
   - Tag-based: All notes with specific tag
   - Folder-based: All notes in specific folder
   - Recommended: Select from candidate clusters
2. Choose synthesis type (Framework/Summary/Comparison/Timeline)
3. AI analyzes notes and generates synthesis note
4. Review and edit the generated synthesis note
```

## Synthesis Types

### Framework
Generate structured framework showing relationships between concepts
```
Example: 5 "Learning Theory" notes → Learning Theory Framework (structured concept map)
```

### Summary
Consolidate key content from multiple notes into one summary
```
Example: 10 "Cognitive Bias" notes → Cognitive Bias Comprehensive Summary
```

### Comparison
Compare similarities, differences, and trade-offs between concepts
```
Example: "Behaviorism vs Cognitivism vs Constructivism" → Learning Theory Comparison
```

### Timeline
Organize historical development of concepts
```
Example: "Psychology History" notes → Psychology Development Timeline
```

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| AI Provider | AI provider to use | OpenAI |
| API Key | API key for selected provider | - |
| Zettelkasten Folder | Note folder path | `04_Zettelkasten` |
| Output Folder | Synthesis note output folder | `04_Zettelkasten` |
| Min cluster size | Minimum cluster size | 3 |
| Use embeddings | Use Vault Embeddings | true |

## Related Plugins

This plugin works well with:

- **[Vault Embeddings](https://github.com/eohjun/obsidian-vault-embeddings)**: Semantic cluster similarity calculation
- **[Evergreen Note Cultivator](https://github.com/eohjun/obsidian-evergreen-note-cultivator)**: Evaluate synthesized note quality
- **[PKM Note Recommender](https://github.com/eohjun/obsidian-pkm-note-recommender)**: Synthesize connected note clusters
- **[AI Canvas Architect](https://github.com/eohjun/obsidian-ai-canvas-architect)**: Visualize synthesis clusters on canvas

## Development

```bash
# Install dependencies
npm install

# Development with watch mode
npm run dev

# Production build
npm run build
```

## License

MIT
