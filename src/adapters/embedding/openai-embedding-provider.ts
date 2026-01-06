/**
 * OpenAI Embedding Provider
 * OpenAI API를 사용한 임베딩 프로바이더
 */

import { requestUrl } from 'obsidian';
import type { IEmbeddingProvider, EmbeddingVector } from '../../core/domain/interfaces/embedding-provider.interface';

export class OpenAIEmbeddingProvider implements IEmbeddingProvider {
  private readonly model = 'text-embedding-3-small';
  private readonly dimensions = 1536;

  constructor(private readonly apiKey: string) {}

  /**
   * 단일 텍스트 임베딩
   */
  async embed(text: string): Promise<number[]> {
    if (!this.isAvailable()) {
      throw new Error('OpenAI API key is not configured');
    }

    const response = await requestUrl({
      url: 'https://api.openai.com/v1/embeddings',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        input: this.truncateText(text),
      }),
    });

    if (response.status !== 200) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = response.json;
    return data.data[0].embedding;
  }

  /**
   * 배치 임베딩
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.isAvailable()) {
      throw new Error('OpenAI API key is not configured');
    }

    if (texts.length === 0) {
      return [];
    }

    const truncatedTexts = texts.map((t) => this.truncateText(t));

    const response = await requestUrl({
      url: 'https://api.openai.com/v1/embeddings',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        input: truncatedTexts,
      }),
    });

    if (response.status !== 200) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = response.json;
    // OpenAI는 결과를 index 순서대로 반환하지 않을 수 있으므로 정렬
    const sortedData = [...data.data].sort(
      (a: { index: number }, b: { index: number }) => a.index - b.index
    );
    return sortedData.map((d: { embedding: number[] }) => d.embedding);
  }

  /**
   * 사용 가능 여부
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
   * 텍스트 길이 제한 (토큰 제한 방지)
   */
  private truncateText(text: string): string {
    // text-embedding-3-small은 약 8191 토큰 제한
    // 대략 4글자 = 1토큰으로 가정하여 30000자로 제한
    const maxLength = 30000;
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength);
  }
}
