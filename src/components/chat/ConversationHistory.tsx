import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { MessageSquarePlus, Trash2, Menu, X, PanelLeftClose, PanelLeft, Plus } from 'lucide-react';
import { Message } from '@/types/chat';

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  timestamp: number;
}

interface ConversationHistoryProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
}

export function ConversationHistory({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
}: ConversationHistoryProps) {
  const [isOpen, setIsOpen] = useState(true);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  const groupedConversations = conversations.reduce((acc, conv) => {
    const dateKey = formatDate(conv.timestamp);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(conv);
    return acc;
  }, {} as Record<string, Conversation[]>);

  return (
    <>
      {/* Collapsed state button - shows when sidebar is closed */}
      {!isOpen && (
        <Button
          variant="ghost"
          size="icon"
          className="fixed bottom-4 left-4 z-50"
          onClick={() => setIsOpen(true)}
          title="Open sidebar"
        >
          <PanelLeft className="w-5 h-5" />
        </Button>
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed top-0 left-0 h-full w-64 bg-background/95 backdrop-blur-sm border-r border-border',
          'flex flex-col transition-all duration-300 z-40',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="p-3 border-b border-border">
          <h2 className="font-semibold text-sm">Chat History</h2>
        </div>

        {/* Conversation list */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-4">
            {Object.entries(groupedConversations).map(([dateKey, convs]) => (
              <div key={dateKey}>
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground">
                  {dateKey}
                </div>
                <div className="space-y-1">
                  {convs.map((conv) => (
                    <div
                      key={conv.id}
                      className={cn(
                        'group flex items-center gap-2 p-2 rounded-lg cursor-pointer',
                        'hover:bg-secondary/80 transition-colors',
                        currentConversationId === conv.id && 'bg-secondary'
                      )}
                      onClick={() => {
                        onSelectConversation(conv.id);
                        setIsOpen(false);
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {conv.title}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConversation(conv.id);
                        }}
                      >
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {conversations.length === 0 && (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                No conversations yet.
                <br />
                Start a new chat!
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer with New Chat and Close buttons */}
        <div className="p-3 border-t border-border flex gap-2">
          <Button
            onClick={onNewConversation}
            className="flex-1"
            size="sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Chat
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsOpen(false)}
            title="Close sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </Button>
        </div>
      </div>

    </>
  );
}
