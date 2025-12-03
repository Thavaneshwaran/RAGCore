// API functions for RAG assistant
// These functions integrate with the local Ollama RAG service

import { ragService } from '@/lib/rag/ragService';
import { loadSettings } from '@/lib/settings';

export interface UploadResult {
  pages: number;
  chunks: number;
}

export interface LoadUrlResult {
  chunks: number;
}

export async function uploadPdf(
  file: File,
  onProgress?: (stage: string, current: number, total: number) => void
): Promise<UploadResult> {
  // Determine file type and process accordingly
  const fileType = getFileType(file);
  
  if (fileType === 'pdf') {
    const result = await ragService.processPDF(file, onProgress);
    return {
      pages: result.pages || 0,
      chunks: result.chunks,
    };
  } else if (fileType === 'text') {
    const result = await ragService.processTextFile(file, onProgress);
    return {
      pages: 1,
      chunks: result.chunks,
    };
  } else if (fileType === 'office') {
    const result = await ragService.processOfficeDocument(file, onProgress);
    return {
      pages: result.pages || 1,
      chunks: result.chunks,
    };
  } else if (fileType === 'image') {
    const result = await ragService.processImage(file, onProgress);
    return {
      pages: 1,
      chunks: result.chunks,
    };
  } else {
    throw new Error(`Unsupported file type: ${file.type}`);
  }
}

function getFileType(file: File): 'pdf' | 'text' | 'office' | 'image' | 'unknown' {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  
  // PDF
  if (type === 'application/pdf' || name.endsWith('.pdf')) {
    return 'pdf';
  }
  
  // Text files
  if (type === 'text/plain' || name.endsWith('.txt')) {
    return 'text';
  }
  
  // Office documents
  if (
    type === 'application/vnd.ms-powerpoint' ||
    type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    type === 'application/msword' ||
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.ppt') ||
    name.endsWith('.pptx') ||
    name.endsWith('.doc') ||
    name.endsWith('.docx')
  ) {
    return 'office';
  }
  
  // Images
  if (
    type.startsWith('image/') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.png') ||
    name.endsWith('.webp')
  ) {
    return 'image';
  }
  
  return 'unknown';
}

export async function loadUrl(
  url: string,
  onProgress?: (stage: string, current: number, total: number) => void
): Promise<LoadUrlResult> {
  const result = await ragService.processURL(url, onProgress);
  return {
    chunks: result.chunks,
  };
}

export function startStreaming(
  question: string,
  onToken: (token: string) => void,
  onSources: (sources: string[]) => void,
  onDone: () => void,
  onError: (err: Error) => void
): () => void {
  let isCancelled = false;
  
  (async () => {
    try {
      const settings = loadSettings();
      const chunkCount = settings.chunkCount || 5;
      const context = await ragService.query(question, chunkCount);
      
      if (!isCancelled && context.length > 0) {
        const sourceStrings = context.map(result => {
          const { chunk, score, weightedScore } = result;
          const source = chunk.metadata.source;
          const page = chunk.metadata.pageNumber;
          const priority = chunk.metadata.priority || 3;
          const pageInfo = page ? ` (Page ${page})` : '';
          const scoreInfo = weightedScore !== undefined 
            ? `Base: ${(score * 100).toFixed(1)}% | Weighted: ${(weightedScore * 100).toFixed(1)}%`
            : `Score: ${(score * 100).toFixed(1)}%`;
          return `[${source}${pageInfo}] (Priority: ${priority} | ${scoreInfo})\n${chunk.content}`;
        });
        onSources(sourceStrings);
      }
      
      if (!isCancelled) {
        await ragService.generateResponse(
          question,
          context,
          (token) => { if (!isCancelled) onToken(token); },
          () => { if (!isCancelled) onDone(); },
          (error) => { if (!isCancelled) onError(error); }
        );
      }
    } catch (err) {
      if (!isCancelled) {
        onError(err instanceof Error ? err : new Error('Unknown error occurred'));
      }
    }
  })();
  
  return () => { isCancelled = true; };
}

export async function clearConversation(): Promise<void> {
  ragService.clear();
}

export function isRAGConfigured(): boolean {
  return ragService.isConfigured();
}

export function getChunkCount(): number {
  return ragService.getChunkCount();
}
