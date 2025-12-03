import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmbeddingRequest {
  provider: 'openai' | 'gemini' | 'lovable' | 'custom';
  model: string;
  text: string;
  baseUrl?: string;
  apiKey?: string;
  customHeaders?: Record<string, string>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: EmbeddingRequest = await req.json();
    const { provider, model, text, baseUrl, customHeaders } = body;

    console.log(`Embedding request: provider=${provider}, model=${model}, text_length=${text.length}`);

    let apiKey: string | undefined;
    let endpoint: string;
    let headers: Record<string, string>;
    let requestBody: any;

    switch (provider) {
      case 'lovable': {
        apiKey = Deno.env.get('LOVABLE_API_KEY');
        if (!apiKey) throw new Error('Lovable API key not configured');
        
        // Lovable AI uses OpenAI-compatible endpoint for embeddings
        endpoint = 'https://ai.gateway.lovable.dev/v1/embeddings';
        headers = {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        };
        requestBody = {
          model,
          input: text,
        };
        break;
      }

      case 'openai': {
        apiKey = Deno.env.get('OPENAI_API_KEY');
        if (!apiKey) throw new Error('OpenAI API key not configured');
        
        endpoint = 'https://api.openai.com/v1/embeddings';
        headers = {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        };
        requestBody = {
          model,
          input: text,
        };
        break;
      }

      case 'gemini': {
        apiKey = Deno.env.get('GEMINI_API_KEY');
        if (!apiKey) throw new Error('Gemini API key not configured');
        
        endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`;
        headers = {
          'Content-Type': 'application/json',
        };
        requestBody = {
          content: {
            parts: [{ text }],
          },
        };
        break;
      }

      case 'custom': {
        if (!baseUrl) throw new Error('Base URL required for custom provider');
        if (!body.apiKey) throw new Error('API key required for custom provider');
        
        endpoint = `${baseUrl}/embeddings`;
        headers = {
          'Authorization': `Bearer ${body.apiKey}`,
          'Content-Type': 'application/json',
          ...customHeaders,
        };
        requestBody = {
          model,
          input: text,
        };
        break;
      }

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    console.log(`Calling ${provider} embedding API at ${endpoint}`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${provider} API error:`, response.status, errorText);
      
      let errorMessage = `${provider} API error: ${errorText}`;
      if (response.status === 429) {
        errorMessage = 'Rate limit exceeded. Please try again later.';
      } else if (response.status === 401 || response.status === 403) {
        errorMessage = 'Invalid API key for embedding provider.';
      } else if (response.status >= 500) {
        errorMessage = `${provider} service temporarily unavailable. Please try again.`;
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage, status: response.status }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const data = await response.json();

    // Convert response to standard format
    let embedding: number[];

    if (provider === 'gemini') {
      embedding = data.embedding?.values || [];
    } else {
      // OpenAI, Lovable, and custom providers use the same format
      embedding = data.data?.[0]?.embedding || [];
    }

    if (!embedding || embedding.length === 0) {
      throw new Error('No embedding returned from provider');
    }

    console.log(`Generated embedding with dimension: ${embedding.length}`);

    return new Response(
      JSON.stringify({ embedding }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in remote-embedding function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
