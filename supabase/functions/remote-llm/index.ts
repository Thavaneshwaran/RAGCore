import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LLMRequest {
  provider: 'openai' | 'gemini' | 'lovable' | 'custom';
  model: string;
  messages: Array<{ role: string; content: string }>;
  stream?: boolean;
  baseUrl?: string;
  apiKey?: string;
  customHeaders?: Record<string, string>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: LLMRequest = await req.json();
    const { provider, model, messages, stream = false, baseUrl, customHeaders } = body;

    console.log(`LLM request: provider=${provider}, model=${model}, stream=${stream}`);

    // Get API key based on provider
    let apiKey: string | undefined;
    let endpoint: string;
    let headers: Record<string, string>;
    let requestBody: any;

    switch (provider) {
      case 'lovable': {
        apiKey = Deno.env.get('LOVABLE_API_KEY');
        if (!apiKey) throw new Error('Lovable API key not configured');
        
        endpoint = 'https://ai.gateway.lovable.dev/v1/chat/completions';
        headers = {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        };
        requestBody = {
          model,
          messages,
          stream,
        };
        break;
      }

      case 'openai': {
        apiKey = Deno.env.get('OPENAI_API_KEY');
        if (!apiKey) throw new Error('OpenAI API key not configured');
        
        endpoint = 'https://api.openai.com/v1/chat/completions';
        headers = {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        };
        requestBody = {
          model,
          messages,
          stream,
        };
        break;
      }

      case 'gemini': {
        apiKey = Deno.env.get('GEMINI_API_KEY');
        if (!apiKey) throw new Error('Gemini API key not configured');
        
        // Gemini uses different endpoint format
        endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${stream ? 'streamGenerateContent' : 'generateContent'}?key=${apiKey}`;
        headers = {
          'Content-Type': 'application/json',
        };
        
        // Convert OpenAI format to Gemini format
        const contents = messages.map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        }));
        
        requestBody = { contents };
        break;
      }

      case 'custom': {
        if (!baseUrl) throw new Error('Base URL required for custom provider');
        if (!body.apiKey) throw new Error('API key required for custom provider');
        
        endpoint = `${baseUrl}/chat/completions`;
        headers = {
          'Authorization': `Bearer ${body.apiKey}`,
          'Content-Type': 'application/json',
          ...customHeaders,
        };
        requestBody = {
          model,
          messages,
          stream,
        };
        break;
      }

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    console.log(`Calling ${provider} API at ${endpoint}`);

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
        errorMessage = 'Invalid API key for LLM provider.';
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

    // Handle streaming responses
    if (stream && (provider === 'openai' || provider === 'lovable' || provider === 'custom')) {
      return new Response(response.body, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Handle Gemini streaming
    if (stream && provider === 'gemini') {
      // Convert Gemini streaming format to OpenAI format
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const encoder = new TextEncoder();
      const decoder = new TextDecoder();

      const stream = new ReadableStream({
        async start(controller) {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value);
              const lines = chunk.split('\n').filter(line => line.trim());

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    
                    if (text) {
                      const openaiFormat = {
                        choices: [{ delta: { content: text }, index: 0 }],
                      };
                      controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify(openaiFormat)}\n\n`)
                      );
                    }
                  } catch (e) {
                    console.error('Error parsing Gemini chunk:', e);
                  }
                }
              }
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch (error) {
            console.error('Streaming error:', error);
            controller.error(error);
          }
        },
      });

      return new Response(stream, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Handle non-streaming responses
    const data = await response.json();

    // Convert Gemini response to OpenAI format
    if (provider === 'gemini') {
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const converted = {
        choices: [
          {
            message: {
              role: 'assistant',
              content: text,
            },
            index: 0,
          },
        ],
      };
      return new Response(JSON.stringify(converted), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in remote-llm function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
