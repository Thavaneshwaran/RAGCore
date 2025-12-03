import { RemoteProviderConfig } from '@/types/settings';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 10000;

interface RetryConfig {
  maxRetries?: number;
  initialBackoff?: number;
  maxBackoff?: number;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateBackoff(attempt: number, initialBackoff: number, maxBackoff: number): number {
  const backoff = initialBackoff * Math.pow(2, attempt);
  return Math.min(backoff, maxBackoff);
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  config: RetryConfig = {}
): Promise<Response> {
  const { 
    maxRetries = MAX_RETRIES, 
    initialBackoff = INITIAL_BACKOFF_MS,
    maxBackoff = MAX_BACKOFF_MS 
  } = config;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Success
      if (response.ok) {
        return response;
      }

      // Don't retry on client errors (except 429 rate limit)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return response;
      }

      // Retry on server errors (5xx) and rate limits (429)
      if (response.status === 429 || response.status >= 500) {
        const errorText = await response.text();
        lastError = new Error(`HTTP ${response.status}: ${errorText}`);

        // Don't retry on last attempt
        if (attempt < maxRetries) {
          const backoffMs = calculateBackoff(attempt, initialBackoff, maxBackoff);
          console.warn(`Request failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${backoffMs}ms...`);
          await sleep(backoffMs);
          continue;
        }
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      // Network errors - retry
      if (attempt < maxRetries) {
        const backoffMs = calculateBackoff(attempt, initialBackoff, maxBackoff);
        console.warn(`Network error (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${backoffMs}ms...`);
        await sleep(backoffMs);
        continue;
      }
    }
  }

  throw lastError || new Error('Request failed after retries');
}

export async function generateRemoteEmbedding(
  text: string,
  config: RemoteProviderConfig,
  retryCount: number = 0
): Promise<number[]> {
  const MAX_RETRIES = 3;
  const RATE_LIMIT_RETRY_DELAY = 5000; // 5 seconds for rate limits
  
  try {
    const response = await fetchWithRetry(`${SUPABASE_URL}/functions/v1/remote-embedding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: config.embeddingProvider,
        model: config.embeddingModel,
        text,
        baseUrl: config.embeddingBaseUrl,
        apiKey: config.embeddingApiKey,
        customHeaders: config.embeddingCustomHeaders,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      
      // Handle rate limits with exponential backoff
      if (response.status === 429 && retryCount < MAX_RETRIES) {
        const delay = RATE_LIMIT_RETRY_DELAY * Math.pow(2, retryCount);
        console.log(`Rate limited. Retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
        await sleep(delay);
        return generateRemoteEmbedding(text, config, retryCount + 1);
      }
      
      let errorMessage = `Failed to generate embedding: ${errorText}`;
      
      if (response.status === 429) {
        errorMessage = '⚠️ RATE LIMIT EXCEEDED\n\n' +
          'Your embedding API has hit its rate limit.\n\n' +
          'Solutions:\n' +
          '1. RECOMMENDED: Use Local Ollama (unlimited, free)\n' +
          '   → Click "Connect Ollama" button in header\n\n' +
          '2. Add/upgrade API key:\n' +
          '   → Settings → Remote Providers → Configure API key\n' +
          '   → Make sure you have available quota\n\n' +
          '3. Wait 1-60 minutes for rate limit to reset\n\n' +
          'This is an API provider limitation, not a bug.';
      } else if (response.status === 401 || response.status === 403) {
        errorMessage = '🔑 API KEY ERROR\n\n' +
          'Your embedding API key is invalid or missing.\n\n' +
          'Fix: Go to Settings → Remote Providers → Configure embedding API key';
      } else if (response.status === 400) {
        try {
          const errorData = JSON.parse(errorText);
          const originalError = errorData.error || errorText;
          
          // Check if it's an API key error
          if (originalError.includes('API key') || originalError.includes('API Key') || originalError.includes('API_KEY')) {
            errorMessage = '🔑 INVALID OR MISSING API KEY\n\n' +
              `Provider: ${config.embeddingProvider.toUpperCase()}\n\n` +
              'You need to configure a valid API key.\n\n' +
              'Solutions:\n' +
              '1. EASIEST: Use Local Ollama (no API key needed)\n' +
              '   → Click "Connect Ollama" in header\n\n' +
              '2. Add API Key:\n' +
              '   → Settings → Remote Providers → Embedding Provider\n' +
              '   → Select provider and enter valid API key\n\n' +
              (config.embeddingProvider === 'gemini' 
                ? '   Get Gemini key: https://makersuite.google.com/app/apikey\n'
                : config.embeddingProvider === 'openai'
                ? '   Get OpenAI key: https://platform.openai.com/api-keys\n'
                : '') +
              '\nOriginal error: ' + originalError;
          } else {
            errorMessage = originalError;
          }
        } catch {
          errorMessage = errorText;
        }
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data.embedding;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to generate embedding');
  }
}

export async function generateRemoteEmbeddings(
  texts: string[],
  config: RemoteProviderConfig,
  onProgress?: (current: number, total: number) => void
): Promise<number[][]> {
  const embeddings: number[][] = [];
  const BATCH_DELAY = 500; // Increased delay between requests

  for (let i = 0; i < texts.length; i++) {
    try {
      const embedding = await generateRemoteEmbedding(texts[i], config);
      embeddings.push(embedding);

      if (onProgress) {
        onProgress(i + 1, texts.length);
      }
      
      // Add delay between requests to avoid rate limiting
      if (i < texts.length - 1) {
        await sleep(BATCH_DELAY);
      }
    } catch (error) {
      console.error(`Failed to embed chunk ${i + 1}/${texts.length}:`, error);
      throw error;
    }
  }

  return embeddings;
}

export async function streamRemoteLLM(
  messages: Array<{ role: string; content: string }>,
  config: RemoteProviderConfig,
  onToken: (token: string) => void,
  onDone: () => void,
  onError: (error: Error) => void
): Promise<void> {
  let attempt = 0;
  const maxAttempts = 2; // Fewer retries for streaming to avoid long delays

  while (attempt <= maxAttempts) {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/remote-llm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: config.llmProvider,
          model: config.llmModel,
          messages,
          stream: true,
          baseUrl: config.llmBaseUrl,
          apiKey: config.llmApiKey,
          customHeaders: config.llmCustomHeaders,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Failed to start stream: ${errorText}`;
        
        if (response.status === 429) {
          errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
          onError(new Error(errorMessage));
          return;
        } else if (response.status === 401 || response.status === 403) {
          errorMessage = 'Invalid API key. Please check your configuration.';
          onError(new Error(errorMessage));
          return;
        } else if (response.status >= 500 && attempt < maxAttempts) {
          // Retry on server errors
          const backoffMs = calculateBackoff(attempt, INITIAL_BACKOFF_MS, 5000);
          console.warn(`Stream failed (attempt ${attempt + 1}/${maxAttempts + 1}), retrying in ${backoffMs}ms...`);
          await sleep(backoffMs);
          attempt++;
          continue;
        }
        
        onError(new Error(errorMessage));
        return;
      }

      if (!response.body) {
        onError(new Error('No response body'));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete lines
          let newlineIndex: number;
          while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
            let line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);

            if (line.endsWith('\r')) line = line.slice(0, -1);
            if (line.startsWith(':') || line.trim() === '') continue;
            if (!line.startsWith('data: ')) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') {
              onDone();
              return;
            }

            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) {
                onToken(content);
              }
            } catch (e) {
              // Partial JSON, put it back
              buffer = line + '\n' + buffer;
              break;
            }
          }
        }

        // Process remaining buffer
        if (buffer.trim()) {
          const lines = buffer.split('\n');
          for (let line of lines) {
            if (!line) continue;
            if (line.endsWith('\r')) line = line.slice(0, -1);
            if (line.startsWith(':') || line.trim() === '') continue;
            if (!line.startsWith('data: ')) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') continue;

            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) {
                onToken(content);
              }
            } catch {
              // Ignore
            }
          }
        }

        onDone();
        return; // Success, exit retry loop
      } catch (streamError) {
        // Stream error during reading
        if (attempt < maxAttempts) {
          const backoffMs = calculateBackoff(attempt, INITIAL_BACKOFF_MS, 5000);
          console.warn(`Stream read error (attempt ${attempt + 1}/${maxAttempts + 1}), retrying in ${backoffMs}ms...`);
          await sleep(backoffMs);
          attempt++;
          continue;
        }
        throw streamError;
      }
    } catch (error) {
      if (attempt >= maxAttempts) {
        onError(error instanceof Error ? error : new Error('Unknown streaming error'));
        return;
      }
      // Continue to next retry attempt
      const backoffMs = calculateBackoff(attempt, INITIAL_BACKOFF_MS, 5000);
      await sleep(backoffMs);
      attempt++;
    }
  }

  onError(new Error('Failed to stream response after multiple attempts'));
}
