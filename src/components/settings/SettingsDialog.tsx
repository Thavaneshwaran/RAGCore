import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { loadSettings, saveSettings, updateMode, updateChunkCount, updateChunkOverlap, updateChunkSize } from '@/lib/settings';
import { AppSettings } from '@/types/settings';
import { RemoteProviderSettings } from './RemoteProviderSettings';
import { ModelComparison } from './ModelComparison';
import { ragService } from '@/lib/rag/ragService';
import { useToast } from '@/hooks/use-toast';
import { Server, Cloud, Download, Upload, Info, Settings2 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  const [chunkCount, setChunkCount] = useState<number>(settings.chunkCount || 5);
  const [chunkOverlap, setChunkOverlap] = useState<number>(settings.chunkOverlap || 10);
  const [chunkSize, setChunkSize] = useState<number>(settings.chunkSize || 500);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const currentSettings = loadSettings();
      setSettings(currentSettings);
      setChunkCount(currentSettings.chunkCount || 5);
      setChunkOverlap(currentSettings.chunkOverlap || 10);
      setChunkSize(currentSettings.chunkSize || 500);
    }
  }, [open]);

  const handleModeChange = (newMode: 'local' | 'remote') => {
    updateMode(newMode);
    setSettings({ ...settings, mode: newMode });
  };

  const handleSettingsChange = (newSettings: AppSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const handleExport = () => {
    try {
      const configJson = ragService.exportConfiguration();
      const blob = new Blob([configJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ragcore-config-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Configuration Exported",
        description: "Your RAGCore configuration has been saved to a file.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export configuration",
        variant: "destructive",
      });
    }
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const result = ragService.importConfiguration(text);
      
      if (result.success) {
        setSettings(loadSettings());
        toast({
          title: "Configuration Imported",
          description: result.warnings ? result.warnings.join(' ') : result.message,
        });
      } else {
        toast({
          title: "Import Failed",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Failed to read configuration file",
        variant: "destructive",
      });
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure your RAG assistant preferences
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="mode" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="mode">Mode</TabsTrigger>
            <TabsTrigger value="rag">
              <Settings2 className="w-3 h-3 mr-1.5" />
              <span className="hidden sm:inline">RAG</span>
            </TabsTrigger>
            <TabsTrigger value="compare">
              <Info className="w-3 h-3 mr-1.5" />
              <span className="hidden sm:inline">Compare</span>
            </TabsTrigger>
            <TabsTrigger value="providers" disabled={settings.mode === 'local'}>
              Remote Providers
            </TabsTrigger>
            <TabsTrigger value="backup">Backup</TabsTrigger>
          </TabsList>

          <TabsContent value="mode" className="space-y-4 pt-4">
            <div className="space-y-4">
              <div className="p-4 border rounded-lg space-y-4">
                <Label className="text-base font-medium">Select Mode</Label>
                <RadioGroup value={settings.mode} onValueChange={(value) => handleModeChange(value as 'local' | 'remote')}>
                  <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="local" id="mode-local" />
                    <Server className="w-5 h-5 text-primary" />
                    <div className="flex-1">
                      <Label htmlFor="mode-local" className="cursor-pointer font-medium">
                        Local Ollama Mode
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Use local Ollama instance for LLM and embeddings
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="remote" id="mode-remote" />
                    <Cloud className="w-5 h-5 text-primary" />
                    <div className="flex-1">
                      <Label htmlFor="mode-remote" className="cursor-pointer font-medium">
                        Remote API Mode
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Use remote API providers (OpenAI, Gemini, Lovable AI)
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>

            <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-start space-x-2">
                {settings.mode === 'local' ? (
                  <Server className="w-4 h-4 mt-0.5 text-primary" />
                ) : (
                  <Cloud className="w-4 h-4 mt-0.5 text-primary" />
                )}
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {settings.mode === 'local' ? 'Local Mode (Ollama)' : 'Remote API Mode'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {settings.mode === 'local'
                      ? 'All inference runs on your local machine using Ollama. Requires a powerful device but completely private.'
                      : 'Connect to cloud-based AI providers. Perfect for users without powerful devices - no local processing required!'}
                  </p>
                </div>
              </div>
              
              {settings.mode === 'remote' && !settings.remoteConfig?.llmApiKey && settings.remoteConfig?.llmProvider !== 'lovable' && (
                <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs text-yellow-600 dark:text-yellow-400">
                  ⚠️ Please configure your LLM API key in the "Remote Providers" tab.
                </div>
              )}
              
              {settings.mode === 'remote' && !settings.remoteConfig?.embeddingApiKey && (
                <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs text-yellow-600 dark:text-yellow-400">
                  ⚠️ Embedding API key required! Configure it in "Remote Providers" tab to avoid rate limits.
                </div>
              )}
              
              {settings.mode === 'remote' && settings.remoteConfig?.llmProvider === 'lovable' && settings.remoteConfig?.embeddingApiKey && (
                <div className="mt-2 p-2 bg-green-500/10 border border-green-500/20 rounded text-xs text-green-600 dark:text-green-400">
                  ✨ Using Lovable AI for LLM (no key needed) + {settings.remoteConfig.embeddingProvider} for embeddings.
                </div>
              )}
            </div>
            </div>
          </TabsContent>

          <TabsContent value="rag" className="space-y-4 pt-4">
            <div className="space-y-4">
              <div className="p-4 border rounded-lg space-y-6">
                <div>
                  <h3 className="text-sm font-medium mb-2">Chunk Retrieval Count</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Number of document chunks to retrieve per query. Higher values provide more context but may be slower.
                  </p>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[chunkCount]}
                      onValueChange={(value) => {
                        setChunkCount(value[0]);
                        updateChunkCount(value[0]);
                      }}
                      min={3}
                      max={20}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-sm font-medium w-8 text-right tabular-nums">{chunkCount}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-2">
                    <span>Faster (3)</span>
                    <span>Balanced (5)</span>
                    <span>More context (20)</span>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium mb-2">Chunk Size (Characters)</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Number of characters per document chunk (200-2000). Smaller chunks are more precise but may lose context.
                  </p>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[chunkSize]}
                      onValueChange={(value) => {
                        setChunkSize(value[0]);
                        updateChunkSize(value[0]);
                      }}
                      min={200}
                      max={2000}
                      step={100}
                      className="flex-1"
                    />
                    <span className="text-sm font-medium w-16 text-right tabular-nums">{chunkSize}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-2">
                    <span>Precise (200)</span>
                    <span>Balanced (500)</span>
                    <span>More context (2000)</span>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium mb-2">Chunk Overlap Percentage</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Amount of overlap between adjacent document chunks (0-50%). Higher overlap improves context continuity but creates more chunks.
                  </p>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[chunkOverlap]}
                      onValueChange={(value) => {
                        setChunkOverlap(value[0]);
                        updateChunkOverlap(value[0]);
                      }}
                      min={0}
                      max={50}
                      step={5}
                      className="flex-1"
                    />
                    <span className="text-sm font-medium w-12 text-right tabular-nums">{chunkOverlap}%</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-2">
                    <span>No overlap (0%)</span>
                    <span>Balanced (10%)</span>
                    <span>High context (50%)</span>
                  </div>
                  <div className="mt-3 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
                    <strong>Note:</strong> Changes apply to newly uploaded documents only. Existing documents retain their original chunking.
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="compare" className="space-y-4 pt-4">
            <ModelComparison />
          </TabsContent>

          <TabsContent value="providers" className="space-y-4 pt-4">
            <RemoteProviderSettings
              settings={settings}
              onSettingsChange={handleSettingsChange}
            />
          </TabsContent>

          <TabsContent value="backup" className="space-y-4 pt-4">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-2">Export Configuration</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Download your RAGCore configuration including sources, priorities, settings, and A/B tests.
                </p>
                <Button onClick={handleExport} className="w-full" variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Export Configuration
                </Button>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-medium mb-2">Import Configuration</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Restore your RAGCore configuration from a backup file. Note: Vector embeddings are not included.
                </p>
                <Button onClick={handleImport} className="w-full" variant="outline">
                  <Upload className="w-4 h-4 mr-2" />
                  Import Configuration
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              <div className="bg-muted/50 p-3 rounded-md">
                <p className="text-xs text-muted-foreground">
                  <strong>Note:</strong> Importing a configuration will overwrite your current settings. 
                  Documents will need to be re-uploaded as embeddings are not included in backups.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
