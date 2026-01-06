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

    const cleanedText = this.cleanText(text);
    if (!cleanedText) {
      throw new Error('Empty text cannot be embedded');
    }

    console.log('[Knowledge Synthesizer] Embedding request:', {
      model: this.model,
      inputLength: cleanedText.length,
      inputPreview: cleanedText.substring(0, 100),
    });

    try {
      const response = await requestUrl({
        url: 'https://api.openai.com/v1/embeddings',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          input: this.truncateText(cleanedText),
        }),
      });

      console.log('[Knowledge Synthesizer] Embedding response status:', response.status);
      return response.json.data[0].embedding;
    } catch (error: unknown) {
      console.error('[Knowledge Synthesizer] Embedding error:', error);

      // Obsidian requestUrl 에러에서 상세 정보 추출
      const err = error as { status?: number; message?: string };
      if (err.status === 400) {
        throw new Error(`OpenAI Embedding API 요청 실패 (400): API 키 또는 모델을 확인하세요`);
      }
      throw new Error(`Embedding 요청 실패: ${err.message || String(error)}`);
    }
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

    // 빈 텍스트 필터링 및 정리
    const cleanedTexts = texts.map((t) => this.cleanText(t));
    const validTexts = cleanedTexts.filter((t) => t.length > 0);

    if (validTexts.length === 0) {
      throw new Error('All texts are empty or whitespace-only');
    }

    const truncatedTexts = validTexts.map((t) => this.truncateText(t));

    console.log('[Knowledge Synthesizer] Batch embedding request:', {
      model: this.model,
      count: truncatedTexts.length,
      lengths: truncatedTexts.map(t => t.length),
    });

    try {
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

      console.log('[Knowledge Synthesizer] Batch embedding response status:', response.status);

      const data = response.json;
      // OpenAI는 결과를 index 순서대로 반환하지 않을 수 있으므로 정렬
      const sortedData = [...data.data].sort(
        (a: { index: number }, b: { index: number }) => a.index - b.index
      );

      // 원본 인덱스에 맞게 결과 매핑 (빈 텍스트는 빈 배열)
      const embeddings = sortedData.map((d: { embedding: number[] }) => d.embedding);
      const result: number[][] = [];
      let embeddingIdx = 0;

      for (const cleaned of cleanedTexts) {
        if (cleaned.length > 0) {
          result.push(embeddings[embeddingIdx++]);
        } else {
          result.push([]); // 빈 텍스트는 빈 벡터
        }
      }

      return result;
    } catch (error: unknown) {
      console.error('[Knowledge Synthesizer] Batch embedding error:', error);

      const err = error as { status?: number; message?: string };
      if (err.status === 400) {
        throw new Error(`OpenAI Embedding API 요청 실패 (400): API 키 또는 모델을 확인하세요`);
      }
      throw new Error(`Batch embedding 요청 실패: ${err.message || String(error)}`);
    }
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
   * 텍스트 정리 (공백 제거 및 정리)
   */
  private cleanText(text: string): string {
    if (!text) return '';
    // 앞뒤 공백 제거 및 연속 공백 정리
    return text.trim().replace(/\s+/g, ' ');
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
