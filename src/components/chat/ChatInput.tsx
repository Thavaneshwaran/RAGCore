import { useState, useRef, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Upload, Link, Loader2, GraduationCap, MoreVertical, Brain, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VoiceInput } from './VoiceInput';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ChatInputProps {
  onSend: (message: string, thinkingMode?: boolean) => void;
  onUploadClick: () => void;
  onUrlClick: () => void;
  onLearningClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  hasDocument?: boolean;
  supportsThinking?: boolean;
  thinkingMode?: boolean;
  onThinkingModeChange?: (enabled: boolean) => void;
}

export function ChatInput({
  onSend,
  onUploadClick,
  onUrlClick,
  onLearningClick,
  disabled,
  isLoading,
  hasDocument,
  supportsThinking = false,
  thinkingMode = false,
  onThinkingModeChange,
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (!message.trim() || disabled || isLoading) return;
    onSend(message.trim(), thinkingMode);
    setMessage('');
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleVoiceTranscript = (transcript: string) => {
    // Set the transcript in the textarea
    setMessage(transcript);
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  };

  const canSend = message.trim() && hasDocument && !disabled && !isLoading;

  return (
    <div className="border-t border-border bg-background p-4">
      <div className="max-w-3xl mx-auto">
        {/* Hint when no document loaded */}
        {!hasDocument && (
          <p className="text-sm text-muted-foreground text-center mb-3">
            Upload a document (PDF, PPT, DOC, TXT, images) or provide a URL first to start asking questions
          </p>
        )}

        <div className="relative flex items-end gap-2 bg-secondary rounded-xl p-2">
          {/* Thinking mode indicator */}
          {thinkingMode && (
            <div className="absolute -top-8 left-0 right-0 flex items-center justify-center">
              <div className="bg-primary/10 text-primary text-xs px-3 py-1 rounded-full flex items-center gap-1.5 border border-primary/20">
                <Brain className="w-3 h-3" />
                <span className="font-medium">Thinking Mode Active</span>
              </div>
            </div>
          )}
          
          {/* Left action buttons */}
          <div className="flex items-center gap-1 pb-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onUploadClick}
              disabled={isLoading}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              aria-label="Upload document"
            >
              <Upload className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onUrlClick}
              disabled={isLoading}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              aria-label="Provide URL"
            >
              <Link className="w-4 h-4" />
            </Button>
            <VoiceInput
              onTranscript={handleVoiceTranscript}
              disabled={isLoading || !hasDocument}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isLoading}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  aria-label="More options"
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={() => onThinkingModeChange?.(false)} disabled={isLoading || !hasDocument}>
                  <Brain className="w-4 h-4 mr-2" />
                  <span className="flex-1">💬 Chat Mode</span>
                  {!thinkingMode && <span className="text-xs text-primary">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onLearningClick} disabled={isLoading || !hasDocument}>
                  <BookOpen className="w-4 h-4 mr-2" />
                  📚 Learning Mode
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onThinkingModeChange?.(true)}
                  disabled={!supportsThinking || isLoading || !hasDocument}
                  className={cn(
                    !supportsThinking && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Brain className="w-4 h-4 mr-2" />
                  <span className="flex-1">🧠 Thinking Mode</span>
                  {thinkingMode && <span className="text-xs text-primary">✓</span>}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={hasDocument ? "Ask a question..." : "Load a document first..."}
            disabled={disabled || !hasDocument}
            rows={1}
            className={cn(
              'flex-1 bg-transparent border-0 resize-none text-foreground placeholder:text-muted-foreground',
              'focus:outline-none focus:ring-0 py-2 px-2 text-sm leading-relaxed',
              'min-h-[40px] max-h-[200px]'
            )}
            aria-label="Message input"
          />

          {/* Send button */}
          <Button
            onClick={handleSubmit}
            disabled={!canSend}
            size="icon"
            className={cn(
              'h-8 w-8 rounded-lg flex-shrink-0 mb-1',
              canSend ? 'bg-primary hover:bg-primary/90' : 'bg-muted'
            )}
            aria-label="Send message"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
