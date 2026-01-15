# Knowledge Synthesizer

관련 노트들을 종합하여 상위 레벨의 프레임워크와 인사이트를 도출하는 AI 기반 Obsidian 플러그인입니다.

## Features

- **자동 클러스터링**: 태그, 폴더, 의미적 유사도 기반으로 관련 노트 그룹화
- **AI 합성**: 여러 유형의 종합 노트 생성
  - **Framework**: 개념들을 구조화한 프레임워크
  - **Summary**: 핵심 내용 요약
  - **Comparison**: 개념 간 비교 분석
  - **Timeline**: 시간순 발전 과정
- **합성 후보 추천**: 합성하기 좋은 노트 클러스터 자동 제안
- **커스텀 선택**: 직접 노트를 선택하여 합성

## PKM Workflow

```
노트 클러스터 → Knowledge Synthesizer → 종합 노트 (프레임워크/요약/비교/타임라인)
                    (합성 Synthesize)
```

## Supported AI Providers

| Provider | Model | 특징 |
|----------|-------|------|
| **OpenAI** | GPT-4o, GPT-4o-mini 등 | 구조화된 프레임워크 생성 |
| **Google Gemini** | Gemini 1.5 Pro/Flash | 긴 컨텍스트 지원, 무료 티어 |
| **Anthropic** | Claude 3.5 Sonnet | 깊이 있는 비교 분석 |

## Installation

### BRAT (권장)

1. [BRAT](https://github.com/TfTHacker/obsidian42-brat) 플러그인 설치
2. BRAT 설정 열기
3. "Add Beta plugin" 클릭
4. 입력: `eohjun/obsidian-knowledge-synthesizer`
5. 플러그인 활성화

### Manual

1. 최신 릴리스에서 `main.js`, `manifest.json`, `styles.css` 다운로드
2. 폴더 생성: `<vault>/.obsidian/plugins/knowledge-synthesizer/`
3. 다운로드한 파일을 폴더에 복사
4. Obsidian 설정에서 플러그인 활성화

## Dependencies (선택)

- **[Vault Embeddings](https://github.com/eohjun/obsidian-vault-embeddings)**: 의미 기반 클러스터링 (권장)

Vault Embeddings가 설치되어 있으면 의미적 유사도 기반 클러스터링이 가능합니다.

## Setup

### API 키 설정

1. Settings → Knowledge Synthesizer 열기
2. **AI Provider** 섹션에서:
   - AI Provider 선택
   - API 키 입력

## Commands

| 명령어 | 설명 |
|--------|------|
| **Synthesize selected notes** | 선택한 노트들을 합성 |
| **Synthesize by tag** | 특정 태그의 노트들을 합성 |
| **Synthesize by folder** | 특정 폴더의 노트들을 합성 |
| **Show synthesis candidates** | 합성 후보 클러스터 보기 |

## Usage Workflow

```
1. 합성할 노트 선택 방법 결정:
   - 직접 선택: 파일 탐색기에서 다중 선택
   - 태그 기반: 특정 태그의 모든 노트
   - 폴더 기반: 특정 폴더의 모든 노트
   - 추천: 합성 후보 클러스터에서 선택
2. 합성 유형 선택 (Framework/Summary/Comparison/Timeline)
3. AI가 노트들을 분석하고 종합 노트 생성
4. 생성된 종합 노트 검토 및 수정
```

## Synthesis Types

### Framework
개념들 간의 관계를 구조화한 프레임워크 생성
```
예: "학습 이론" 관련 5개 노트 → 학습 이론 프레임워크 (구조화된 개념 지도)
```

### Summary
여러 노트의 핵심 내용을 하나로 요약
```
예: "인지 편향" 관련 10개 노트 → 인지 편향 종합 요약
```

### Comparison
개념들 간의 공통점, 차이점, 장단점 비교
```
예: "행동주의 vs 인지주의 vs 구성주의" → 학습 이론 비교 분석
```

### Timeline
개념의 역사적 발전 과정 정리
```
예: "심리학 역사" 관련 노트들 → 심리학 발전 타임라인
```

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| AI Provider | 사용할 AI 프로바이더 | OpenAI |
| API Key | 선택한 프로바이더의 API 키 | - |
| Zettelkasten Folder | 노트 폴더 경로 | `04_Zettelkasten` |
| Output Folder | 합성 노트 저장 폴더 | `04_Zettelkasten` |
| Min cluster size | 최소 클러스터 크기 | 3 |
| Use embeddings | Vault Embeddings 사용 | true |

## Related Plugins

이 플러그인은 다음 플러그인들과 잘 연계됩니다:

- **[Vault Embeddings](https://github.com/eohjun/obsidian-vault-embeddings)**: 의미 기반 클러스터 유사도 계산
- **[Evergreen Note Cultivator](https://github.com/eohjun/obsidian-evergreen-note-cultivator)**: 합성된 노트 품질 평가
- **[PKM Note Recommender](https://github.com/eohjun/obsidian-pkm-note-recommender)**: 연결된 노트 클러스터를 합성
- **[AI Canvas Architect](https://github.com/eohjun/obsidian-ai-canvas-architect)**: 합성 클러스터를 캔버스로 시각화

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
