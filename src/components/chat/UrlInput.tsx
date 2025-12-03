import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link, Loader2, X } from 'lucide-react';

interface UrlInputProps {
  onSubmit: (url: string) => Promise<void>;
  onClose: () => void;
  isLoading: boolean;
}

export function UrlInput({ onSubmit, onClose, isLoading }: UrlInputProps) {
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSubmit(url.trim());
    }
  };

  const isValidUrl = (string: string) => {
    try {
      new URL(string);
      return true;
    } catch {
      return false;
    }
  };

  const canSubmit = url.trim() && isValidUrl(url.trim()) && !isLoading;

  return (
    <div className="p-4 bg-secondary rounded-xl">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Link className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Load from URL</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-6 w-6"
          aria-label="Close URL input"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/document"
          disabled={isLoading}
          className="flex-1 bg-background border-border"
          aria-label="URL input"
        />
        <Button
          type="submit"
          disabled={!canSubmit}
          className="px-4"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            'Load'
          )}
        </Button>
      </form>

      <p className="text-xs text-muted-foreground mt-2">
        Enter a URL to a webpage or document to load its content
      </p>
    </div>
  );
}
