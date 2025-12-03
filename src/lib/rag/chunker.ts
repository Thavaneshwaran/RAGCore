import { TextChunk, ChunkMetadata } from './types';

export interface ChunkOptions {
  chunkSize: number;
  chunkOverlap: number;
}

const DEFAULT_OPTIONS: ChunkOptions = {
  chunkSize: 500,
  chunkOverlap: 50,
};

export function generateChunkId(): string {
  return `chunk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function splitTextIntoChunks(
  text: string,
  source: string,
  sourceType: 'pdf' | 'url' | 'text' | 'office' | 'image',
  options: ChunkOptions = DEFAULT_OPTIONS,
  pageNumber?: number
): TextChunk[] {
  const { chunkSize, chunkOverlap } = options;
  const chunks: TextChunk[] = [];
  
  // Clean and normalize text
  const cleanedText = text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();
  
  if (!cleanedText) return chunks;
  
  // Split by sentences first for better context preservation
  const sentences = cleanedText.match(/[^.!?]+[.!?]+/g) || [cleanedText];
  
  let currentChunk = '';
  let chunkIndex = 0;
  
  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    
    if ((currentChunk + ' ' + trimmedSentence).length > chunkSize && currentChunk) {
      // Save current chunk
      chunks.push({
        id: generateChunkId(),
        content: currentChunk.trim(),
        metadata: {
          source,
          sourceType,
          pageNumber,
          chunkIndex,
          totalChunks: 0, // Will be updated later
        },
      });
      
      // Start new chunk with overlap
      const words = currentChunk.split(' ');
      const overlapWords = words.slice(-Math.ceil(chunkOverlap / 5));
      currentChunk = overlapWords.join(' ') + ' ' + trimmedSentence;
      chunkIndex++;
    } else {
      currentChunk = currentChunk ? currentChunk + ' ' + trimmedSentence : trimmedSentence;
    }
  }
  
  // Add remaining text as final chunk
  if (currentChunk.trim()) {
    chunks.push({
      id: generateChunkId(),
      content: currentChunk.trim(),
      metadata: {
        source,
        sourceType,
        pageNumber,
        chunkIndex,
        totalChunks: 0,
      },
    });
  }
  
  // Update total chunks count
  chunks.forEach(chunk => {
    chunk.metadata.totalChunks = chunks.length;
  });
  
  return chunks;
}

export function chunkDocument(
  pages: { text: string; pageNumber: number }[],
  source: string,
  sourceType: 'pdf' | 'url' | 'text' | 'office' | 'image',
  options?: ChunkOptions
): TextChunk[] {
  const allChunks: TextChunk[] = [];
  
  for (const page of pages) {
    const pageChunks = splitTextIntoChunks(
      page.text,
      source,
      sourceType,
      options,
      page.pageNumber
    );
    allChunks.push(...pageChunks);
  }
  
  // Re-index all chunks
  allChunks.forEach((chunk, index) => {
    chunk.metadata.chunkIndex = index;
    chunk.metadata.totalChunks = allChunks.length;
  });
  
  return allChunks;
}
