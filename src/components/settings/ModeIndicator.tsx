import { Server, Cloud } from 'lucide-react';
import { loadSettings } from '@/lib/settings';
import { Badge } from '@/components/ui/badge';

export function ModeIndicator() {
  const settings = loadSettings();

  return (
    <Badge 
      variant={settings.mode === 'remote' ? 'default' : 'secondary'} 
      className="flex items-center gap-1.5"
    >
      {settings.mode === 'remote' ? (
        <>
          <Cloud className="w-3 h-3" />
          <span>Remote API</span>
        </>
      ) : (
        <>
          <Server className="w-3 h-3" />
          <span>Local Ollama</span>
        </>
      )}
    </Badge>
  );
}
