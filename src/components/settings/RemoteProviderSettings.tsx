import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { AppSettings, LLM_PROVIDERS, EMBEDDING_PROVIDERS, LLMProvider, EmbeddingProvider } from '@/types/settings';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Eye, EyeOff, Save } from 'lucide-react';
import { toast } from 'sonner';

interface RemoteProviderSettingsProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

export function RemoteProviderSettings({ settings, onSettingsChange }: RemoteProviderSettingsProps) {
  const [showLLMKey, setShowLLMKey] = useState(false);
  const [showEmbeddingKey, setShowEmbeddingKey] = useState(false);

  // Handle invalid saved settings (e.g., 'lovable' embedding provider that was removed)
  const savedConfig = settings.remoteConfig;
  let embeddingProvider: EmbeddingProvider = 'openai';
  let embeddingModel = 'text-embedding-3-small';
  
  // Validate saved embedding provider still exists
  if (savedConfig?.embeddingProvider && EMBEDDING_PROVIDERS[savedConfig.embeddingProvider]) {
    embeddingProvider = savedConfig.embeddingProvider;
    embeddingModel = savedConfig.embeddingModel || EMBEDDING_PROVIDERS[embeddingProvider].models[0] || 'text-embedding-3-small';
  }

  const config = savedConfig || {
    llmProvider: 'lovable' as LLMProvider,
    llmApiKey: '',
    llmModel: 'google/gemini-2.5-flash',
    embeddingProvider,
    embeddingApiKey: '',
    embeddingModel,
  };
  
  // Ensure config has valid values
  if (!EMBEDDING_PROVIDERS[config.embeddingProvider]) {
    config.embeddingProvider = 'openai';
    config.embeddingModel = 'text-embedding-3-small';
  }

  const handleSave = () => {
    // Validate configuration
    if (config.llmProvider !== 'lovable' && !config.llmApiKey) {
      toast.error('Please enter an LLM API key');
      return;
    }
    if (!config.embeddingApiKey) {
      toast.error('Please enter an Embedding API key (Lovable AI only supports LLMs, not embeddings)');
      return;
    }
    if (!config.llmModel) {
      toast.error('Please select an LLM model');
      return;
    }
    if (!config.embeddingModel) {
      toast.error('Please select an Embedding model');
      return;
    }
    
    if (config.llmProvider === 'custom' && !config.llmBaseUrl) {
      toast.error('Please enter a base URL for custom LLM provider');
      return;
    }
    
    if (config.embeddingProvider === 'custom' && !config.embeddingBaseUrl) {
      toast.error('Please enter a base URL for custom embedding provider');
      return;
    }
    
    onSettingsChange({
      ...settings,
      remoteConfig: config,
    });
    toast.success('Remote provider settings saved');
  };

  const updateConfig = (updates: Partial<typeof config>) => {
    onSettingsChange({
      ...settings,
      remoteConfig: { ...config, ...updates },
    });
  };

  return (
    <div className="space-y-6">
      <Accordion type="single" collapsible defaultValue="llm">
        <AccordionItem value="llm">
          <AccordionTrigger className="text-base font-medium">
            LLM Provider Configuration
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="llm-provider">Provider</Label>
              <Select
                value={config.llmProvider}
                onValueChange={(value) => updateConfig({ llmProvider: value as LLMProvider })}
              >
                <SelectTrigger id="llm-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LLM_PROVIDERS).map(([key, { name }]) => (
                    <SelectItem key={key} value={key}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {config.llmProvider === 'lovable' && (
                <p className="text-xs text-muted-foreground">
                  ✨ Lovable AI provides access to powerful cloud LLMs without requiring your own API key. Perfect for users without powerful devices!
                </p>
              )}
            </div>

            {config.llmProvider !== 'lovable' && (
              <div className="space-y-2">
                <Label htmlFor="llm-api-key">API Key</Label>
                <div className="flex space-x-2">
                  <Input
                    id="llm-api-key"
                    type={showLLMKey ? 'text' : 'password'}
                    value={config.llmApiKey}
                    onChange={(e) => updateConfig({ llmApiKey: e.target.value })}
                    placeholder="Enter your API key"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowLLMKey(!showLLMKey)}
                  >
                    {showLLMKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="llm-model">Model</Label>
              {config.llmProvider === 'custom' ? (
                <Input
                  id="llm-model"
                  value={config.llmModel}
                  onChange={(e) => updateConfig({ llmModel: e.target.value })}
                  placeholder="Enter model name"
                />
              ) : (
                <Select
                  value={config.llmModel}
                  onValueChange={(value) => updateConfig({ llmModel: value })}
                >
                  <SelectTrigger id="llm-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(LLM_PROVIDERS[config.llmProvider]?.models || []).map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {config.llmProvider === 'custom' && (
              <div className="space-y-2">
                <Label htmlFor="llm-base-url">Base URL</Label>
                <Input
                  id="llm-base-url"
                  value={config.llmBaseUrl || ''}
                  onChange={(e) => updateConfig({ llmBaseUrl: e.target.value })}
                  placeholder="https://api.example.com"
                />
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="embedding">
          <AccordionTrigger className="text-base font-medium">
            Embedding Provider Configuration
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="embedding-provider">Provider</Label>
              <Select
                value={config.embeddingProvider}
                onValueChange={(value) => updateConfig({ embeddingProvider: value as EmbeddingProvider })}
              >
                <SelectTrigger id="embedding-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EMBEDDING_PROVIDERS).map(([key, { name }]) => (
                    <SelectItem key={key} value={key}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Note: Lovable AI only supports LLM models, not embeddings. Use OpenAI, Gemini, or a custom provider for embeddings.
              </p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="embedding-api-key">API Key</Label>
                <div className="flex space-x-2">
                  <Input
                    id="embedding-api-key"
                    type={showEmbeddingKey ? 'text' : 'password'}
                    value={config.embeddingApiKey}
                    onChange={(e) => updateConfig({ embeddingApiKey: e.target.value })}
                    placeholder="Enter your API key"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowEmbeddingKey(!showEmbeddingKey)}
                  >
                    {showEmbeddingKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

            <div className="space-y-2">
              <Label htmlFor="embedding-model">Model</Label>
              {config.embeddingProvider === 'custom' ? (
                <Input
                  id="embedding-model"
                  value={config.embeddingModel}
                  onChange={(e) => updateConfig({ embeddingModel: e.target.value })}
                  placeholder="Enter model name"
                />
              ) : (
                <Select
                  value={config.embeddingModel}
                  onValueChange={(value) => updateConfig({ embeddingModel: value })}
                >
                  <SelectTrigger id="embedding-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(EMBEDDING_PROVIDERS[config.embeddingProvider]?.models || []).map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {config.embeddingProvider === 'custom' && (
              <div className="space-y-2">
                <Label htmlFor="embedding-base-url">Base URL</Label>
                <Input
                  id="embedding-base-url"
                  value={config.embeddingBaseUrl || ''}
                  onChange={(e) => updateConfig({ embeddingBaseUrl: e.target.value })}
                  placeholder="https://api.example.com"
                />
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Button onClick={handleSave} className="w-full">
        <Save className="w-4 h-4 mr-2" />
        Save Configuration
      </Button>
    </div>
  );
}
