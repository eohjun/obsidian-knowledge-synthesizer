/**
 * OpenAI Embedding Provider
 * OpenAI API를 사용한 임베딩 프로바이더
 * (Learning Path Generator 구현 참조)
 */

import { requestUrl } from 'obsidian';
import type { IEmbeddingProvider, EmbeddingVector } from '../../core/domain/interfaces/embedding-provider.interface';

const OPENAI_EMBEDDING_URL = 'https://api.openai.com/v1/embeddings';
const DEFAULT_MODEL = 'text-embedding-3-small';
const DEFAULT_DIMENSIONS = 1536;

export class OpenAIEmbeddingProvider implements IEmbeddingProvider {
  private apiKey: string;
  private model: string;
  private dimensions: number;

  constructor(apiKey: string, model?: string, dimensions?: number) {
    this.apiKey = apiKey;
    this.model = model ?? DEFAULT_MODEL;
    this.dimensions = dimensions ?? DEFAULT_DIMENSIONS;
  }

  /**
   * 프로바이더 사용 가능 여부
   */
  isAvailable(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  /**
   * 벡터 차원 수
   */
  getDimensions(): number {
    return this.dimensions;
  }

  /**
   * 단일 텍스트를 벡터로 변환
   */
  async embed(text: string): Promise<number[]> {
    if (!this.isAvailable()) {
      throw new Error('[OpenAIEmbeddingProvider] API key not configured');
    }

    const cleanedText = this.cleanText(text);
    if (!cleanedText) {
      throw new Error('[OpenAIEmbeddingProvider] Empty text provided');
    }

    console.log('[Knowledge Synthesizer] Embedding request:', {
      model: this.model,
      inputLength: cleanedText.length,
    });

    try {
      const response = await requestUrl({
        url: OPENAI_EMBEDDING_URL,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          input: cleanedText,
          dimensions: this.dimensions,
        }),
      });

      if (response.status !== 200) {
        const errorBody = response.text || 'No response body';
        console.error('[Knowledge Synthesizer] API error response:', errorBody);
        throw new Error(`OpenAI API error ${response.status}: ${errorBody.slice(0, 200)}`);
      }

      if (!response.text || response.text.length === 0) {
        throw new Error('OpenAI API returned empty response');
      }

      const data = response.json;
      if (!data?.data?.[0]?.embedding) {
        throw new Error(`Invalid API response structure: ${JSON.stringify(data).slice(0, 200)}`);
      }

      return data.data[0].embedding;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[Knowledge Synthesizer] Embedding failed:', message);
      throw new Error(`임베딩 실패: ${message}`);
    }
  }

  /**
   * 여러 텍스트를 배치로 변환
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.isAvailable()) {
      throw new Error('[OpenAIEmbeddingProvider] API key not configured');
    }

    // 빈 텍스트 인덱스 추적
    const cleanedTexts = texts.map(t => this.cleanText(t));
    const nonEmptyIndices: number[] = [];
    const textsToEmbed: string[] = [];

    for (let i = 0; i < cleanedTexts.length; i++) {
      if (cleanedTexts[i].length > 0) {
        nonEmptyIndices.push(i);
        textsToEmbed.push(cleanedTexts[i]);
      }
    }

    if (textsToEmbed.length === 0) {
      return texts.map(() => []);
    }

    console.log('[Knowledge Synthesizer] Batch embedding request:', {
      model: this.model,
      count: textsToEmbed.length,
    });

    try {
      const response = await requestUrl({
        url: OPENAI_EMBEDDING_URL,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          input: textsToEmbed,
          dimensions: this.dimensions,
        }),
      });

      if (response.status !== 200) {
        const errorBody = response.text || 'No response body';
        console.error('[Knowledge Synthesizer] Batch API error:', errorBody);
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = response.json;
      const embeddings = data.data
        .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
        .map((item: { embedding: number[] }) => item.embedding);

      // 원본 배열과 동일한 길이로 재구성 (빈 텍스트는 빈 벡터)
      const result: number[][] = texts.map(() => []);
      for (let i = 0; i < nonEmptyIndices.length; i++) {
        result[nonEmptyIndices[i]] = embeddings[i];
      }

      return result;
    } catch (error) {
      console.error('[Knowledge Synthesizer] Batch embedding failed:', error);
      throw error;
    }
  }

  /**
   * 텍스트 전처리
   */
  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000);
  }
}
