import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Set worker source using Vite's URL import
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface ParsedPage {
  pageNumber: number;
  text: string;
}

export interface ParsedPDF {
  pages: ParsedPage[];
  totalPages: number;
  metadata?: {
    title?: string;
    author?: string;
  };
}

export async function parsePDF(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<ParsedPDF> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  const pages: ParsedPage[] = [];
  const totalPages = pdf.numPages;
  
  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    
    const text = textContent.items
      .map((item: any) => item.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    pages.push({
      pageNumber: i,
      text,
    });
    
    if (onProgress) {
      onProgress(i, totalPages);
    }
  }
  
  // Try to get metadata
  let metadata: ParsedPDF['metadata'];
  try {
    const meta = await pdf.getMetadata();
    metadata = {
      title: (meta.info as any)?.Title,
      author: (meta.info as any)?.Author,
    };
  } catch {
    // Metadata not available
  }
  
  return {
    pages,
    totalPages,
    metadata,
  };
}
