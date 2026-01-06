/**
 * LLM Synthesis Generator
 * LLM을 사용한 노트 합성 생성기
 */

import { requestUrl } from 'obsidian';
import type {
  ISynthesisGenerator,
  NoteContent,
} from '../../core/domain/interfaces/synthesis-generator.interface';
import type { SynthesisRequest, SynthesisType } from '../../core/domain/entities/synthesis-request';
import { createSynthesisResult, SynthesisResult } from '../../core/domain/entities/synthesis-result';

export type LLMProvider = 'openai' | 'anthropic';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model?: string;
}

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-latest',
};

export class LLMSynthesisGenerator implements ISynthesisGenerator {
  private readonly model: string;

  constructor(private readonly config: LLMConfig) {
    this.model = config.model || DEFAULT_MODELS[config.provider];
  }

  /**
   * 합성 노트 생성
   */
  async generate(request: SynthesisRequest, noteContents: NoteContent[]): Promise<SynthesisResult> {
    const prompt = this.buildPrompt(request, noteContents);
    const content = await this.callLLM(prompt);

    // 태그 추천 (옵션이 활성화된 경우)
    let suggestedTags: string[] = [];
    if (request.options.autoSuggestTags) {
      suggestedTags = await this.suggestTags(content, noteContents);
    }

    // 원본 노트 링크 생성
    const sourceNoteLinks = noteContents.map((n) => `[[${n.title}]]`);

    return createSynthesisResult(
      request.id,
      request.targetTitle || '종합 노트',
      content,
      sourceNoteLinks,
      request.synthesisType,
      suggestedTags
    );
  }

  /**
   * 제목 제안
   */
  async suggestTitle(noteContents: NoteContent[]): Promise<string> {
    const prompt = this.buildTitlePrompt(noteContents);
    const response = await this.callLLM(prompt);
    return response.trim().replace(/^["']|["']$/g, ''); // 따옴표 제거
  }

  /**
   * 합성 타입 제안
   */
  async suggestType(noteContents: NoteContent[]): Promise<SynthesisType> {
    const titles = noteContents.map((n) => n.title).join(', ');
    const prompt = `다음 노트들을 분석하고 가장 적합한 합성 타입을 하나만 선택해서 그 타입명만 반환해.

노트 목록: ${titles}

합성 타입:
- framework: 여러 개념을 종합하여 하나의 프레임워크로 구조화
- summary: 핵심 내용을 요약
- comparison: 노트들 간의 비교 분석
- timeline: 시간순 정리

응답은 framework, summary, comparison, timeline 중 하나만.`;

    const response = await this.callLLM(prompt);
    const type = response.trim().toLowerCase() as SynthesisType;

    if (['framework', 'summary', 'comparison', 'timeline'].includes(type)) {
      return type;
    }
    return 'framework'; // 기본값
  }

  /**
   * 사용 가능 여부
   */
  isAvailable(): boolean {
    return !!this.config.apiKey && this.config.apiKey.length > 0;
  }

  /**
   * 프롬프트 생성
   */
  private buildPrompt(request: SynthesisRequest, noteContents: NoteContent[]): string {
    const typeInstructions = this.getTypeInstructions(request.synthesisType);
    const language = request.options.language === 'ko' ? '한국어' : 'English';

    const notesText = noteContents
      .map((n) => `## ${n.title}\n\n${n.content}`)
      .join('\n\n---\n\n');

    return `당신은 PKM(개인 지식 관리) 전문가입니다. 다음 노트들을 분석하고 ${typeInstructions}

## 지침
- 언어: ${language}
- 원본 노트의 핵심 인사이트를 보존하세요
- 새로운 연결과 패턴을 발견하세요
- 마크다운 형식으로 작성하세요
${request.options.includeBacklinks ? '- 원본 노트로의 역링크([[노트명]])를 적절히 포함하세요' : ''}

## 원본 노트들

${notesText}

## 합성 결과`;
  }

  /**
   * 타입별 지시사항
   */
  private getTypeInstructions(type: SynthesisType): string {
    const instructions: Record<SynthesisType, string> = {
      framework: '하나의 종합적인 프레임워크로 구조화하세요. 핵심 개념들 간의 관계를 명확히 하고, 상위 수준의 통합 인사이트를 도출하세요.',
      summary: '핵심 내용을 간결하게 요약하세요. 각 노트의 주요 포인트를 추출하고 통합하세요.',
      comparison: '노트들 간의 유사점과 차이점을 분석하세요. 표나 구조화된 비교를 활용하세요.',
      timeline: '시간순으로 정리하세요. 발전 과정이나 변화를 강조하세요.',
    };
    return instructions[type];
  }

  /**
   * 제목 프롬프트 생성
   */
  private buildTitlePrompt(noteContents: NoteContent[]): string {
    const titles = noteContents.map((n) => n.title).join(', ');
    return `다음 노트들을 종합한 합성 노트의 제목을 제안해주세요.
간결하고 핵심을 담은 제목으로, 따옴표 없이 제목만 반환하세요.

노트 목록: ${titles}

제안 제목:`;
  }

  /**
   * 태그 추천
   */
  private async suggestTags(content: string, noteContents: NoteContent[]): Promise<string[]> {
    // 기존 태그 수집
    const existingTags = new Set<string>();
    for (const note of noteContents) {
      for (const tag of note.tags) {
        existingTags.add(tag);
      }
    }

    // 간단한 방법: 원본 노트들의 태그 중 2개 이상 나타난 것 반환
    const tagCounts = new Map<string, number>();
    for (const note of noteContents) {
      for (const tag of note.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    const suggestedTags: string[] = [];
    for (const [tag, count] of tagCounts) {
      if (count >= 2) {
        suggestedTags.push(tag);
      }
    }

    return suggestedTags.slice(0, 5); // 최대 5개
  }

  /**
   * LLM API 호출
   */
  private async callLLM(prompt: string): Promise<string> {
    if (this.config.provider === 'openai') {
      return this.callOpenAI(prompt);
    } else {
      return this.callAnthropic(prompt);
    }
  }

  /**
   * OpenAI API 호출
   */
  private async callOpenAI(prompt: string): Promise<string> {
    const response = await requestUrl({
      url: 'https://api.openai.com/v1/chat/completions',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (response.status !== 200) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    return response.json.choices[0].message.content;
  }

  /**
   * Anthropic API 호출
   */
  private async callAnthropic(prompt: string): Promise<string> {
    const response = await requestUrl({
      url: 'https://api.anthropic.com/v1/messages',
      method: 'POST',
      headers: {
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (response.status !== 200) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    return response.json.content[0].text;
  }
}
