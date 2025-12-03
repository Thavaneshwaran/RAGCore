import { TextChunk } from './types';

export async function generateEmbedding(
  text: string,
  baseUrl: string,
  model: string
): Promise<number[]> {
  const response = await fetch(`${baseUrl}/api/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt: text,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to generate embedding: ${error}`);
  }
  
  const data = await response.json();
  return data.embedding;
}

export async function generateEmbeddings(
  chunks: TextChunk[],
  baseUrl: string,
  model: string,
  onProgress?: (current: number, total: number) => void
): Promise<TextChunk[]> {
  const embeddedChunks: TextChunk[] = [];
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    
    try {
      const embedding = await generateEmbedding(chunk.content, baseUrl, model);
      embeddedChunks.push({
        ...chunk,
        embedding,
      });
      
      if (onProgress) {
        onProgress(i + 1, chunks.length);
      }
    } catch (error) {
      console.error(`Failed to embed chunk ${chunk.id}:`, error);
      // Continue with other chunks
      embeddedChunks.push(chunk);
    }
  }
  
  return embeddedChunks;
}

export async function embedQuery(
  query: string,
  baseUrl: string,
  model: string
): Promise<number[]> {
  return generateEmbedding(query, baseUrl, model);
}
