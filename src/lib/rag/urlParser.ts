import { ParsedPage } from './pdfParser';

export interface ParsedURL {
  pages: ParsedPage[];
  title?: string;
  url: string;
}

// Extract text content from HTML
function extractTextFromHTML(html: string): string {
  // Create a temporary DOM element
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Remove script, style, and other non-content elements
  const elementsToRemove = doc.querySelectorAll(
    'script, style, nav, header, footer, aside, noscript, iframe, svg, [role="navigation"], [role="banner"], [role="contentinfo"]'
  );
  elementsToRemove.forEach(el => el.remove());
  
  // Get main content area if available
  const mainContent = doc.querySelector('main, article, [role="main"], .content, #content, .post, .article');
  const contentElement = mainContent || doc.body;
  
  // Extract text
  const text = contentElement?.textContent || '';
  
  // Clean up whitespace
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();
}

export async function parseURL(url: string): Promise<ParsedURL> {
  // Use a CORS proxy for fetching external URLs
  // In production, you'd want to use your own proxy or backend
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  
  try {
    const response = await fetch(proxyUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }
    
    const html = await response.text();
    const text = extractTextFromHTML(html);
    
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : undefined;
    
    if (!text || text.length < 50) {
      throw new Error('Could not extract meaningful content from the URL');
    }
    
    return {
      pages: [{ pageNumber: 1, text }],
      title,
      url,
    };
  } catch (error) {
    // Fallback: try direct fetch (works for same-origin or CORS-enabled URLs)
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.statusText}`);
      }
      
      const html = await response.text();
      const text = extractTextFromHTML(html);
      
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : undefined;
      
      return {
        pages: [{ pageNumber: 1, text }],
        title,
        url,
      };
    } catch {
      throw error;
    }
  }
}
