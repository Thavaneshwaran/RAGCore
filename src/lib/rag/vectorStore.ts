import { TextChunk, VectorSearchResult } from './types';

class VectorStore {
  private chunks: Map<string, TextChunk> = new Map();
  
  add(chunk: TextChunk): void {
    if (!chunk.embedding) {
      console.warn('Adding chunk without embedding:', chunk.id);
    }
    this.chunks.set(chunk.id, chunk);
  }
  
  addMany(chunks: TextChunk[]): void {
    chunks.forEach(chunk => this.add(chunk));
  }
  
  get(id: string): TextChunk | undefined {
    return this.chunks.get(id);
  }
  
  getAll(): TextChunk[] {
    return Array.from(this.chunks.values());
  }
  
  clear(): void {
    this.chunks.clear();
  }
  
  size(): number {
    return this.chunks.size;
  }
  
  // Cosine similarity between two vectors
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }
  
  // Search for similar chunks using cosine similarity
  search(queryEmbedding: number[], topK: number = 5): VectorSearchResult[] {
    const results: VectorSearchResult[] = [];
    
    for (const chunk of this.chunks.values()) {
      if (!chunk.embedding) continue;
      
      const score = this.cosineSimilarity(queryEmbedding, chunk.embedding);
      results.push({ chunk, score });
    }
    
    // Sort by score descending and take top K
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
  
  // Weighted search that considers source priority
  searchWeighted(
    queryEmbedding: number[],
    topK: number = 5,
    sourcePriorities: Map<string, number> = new Map()
  ): VectorSearchResult[] {
    const results: VectorSearchResult[] = [];
    
    for (const chunk of this.chunks.values()) {
      if (!chunk.embedding) continue;
      
      const baseScore = this.cosineSimilarity(queryEmbedding, chunk.embedding);
      
      // Apply source priority weighting
      // Priority scale: 1-5, where 5 is highest
      // Default priority is 3 (neutral)
      const priority = chunk.metadata.priority || sourcePriorities.get(chunk.metadata.source) || 3;
      
      // Weight formula: weighted = base * (0.5 + priority * 0.2)
      // Priority 1: 0.7x, Priority 2: 0.9x, Priority 3: 1.1x, Priority 4: 1.3x, Priority 5: 1.5x
      const priorityMultiplier = 0.5 + (priority * 0.2);
      const weightedScore = baseScore * priorityMultiplier;
      
      results.push({ 
        chunk, 
        score: baseScore,
        weightedScore 
      });
    }
    
    // Sort by weighted score descending and take top K
    return results
      .sort((a, b) => (b.weightedScore || b.score) - (a.weightedScore || a.score))
      .slice(0, topK);
  }
  
  // Get chunks by source
  getBySource(source: string): TextChunk[] {
    return Array.from(this.chunks.values()).filter(
      chunk => chunk.metadata.source === source
    );
  }
  
  // Remove chunks by source
  removeBySource(source: string): number {
    let removed = 0;
    for (const [id, chunk] of this.chunks.entries()) {
      if (chunk.metadata.source === source) {
        this.chunks.delete(id);
        removed++;
      }
    }
    return removed;
  }
}

// Singleton instance
export const vectorStore = new VectorStore();
