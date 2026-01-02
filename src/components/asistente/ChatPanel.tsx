import { useState, useRef, useEffect } from 'react';
import { Message, ExpedienteState } from '@/types/expediente';
import { ChatMessage } from './ChatMessage';
import { QuickReplies } from './QuickReplies';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Paperclip, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatPanelProps {
  messages: Message[];
  estado: ExpedienteState;
  onSendMessage: (content: string) => void;
  onAttachFile: () => void;
  className?: string;
}

export function ChatPanel({
  messages,
  estado,
  onSendMessage,
  onAttachFile,
  className,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleQuickReply = (reply: string) => {
    onSendMessage(reply);
  };

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Header */}
      <div className="border-b border-border bg-background px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Asistente técnico</h2>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>Orientación preliminar</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Quick Replies */}
      <div className="border-t border-border bg-muted/30 px-4 py-2">
        <QuickReplies estado={estado} onSelect={handleQuickReply} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-border bg-background p-4">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onAttachFile}
            className="flex-shrink-0"
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu mensaje..."
            className="min-h-[44px] max-h-32 resize-none"
            rows={1}
          />

          <Button
            type="submit"
            size="icon"
            disabled={!input.trim()}
            className="flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          Pulsa Enter para enviar, Shift+Enter para salto de línea
        </p>
      </form>
    </div>
  );
}
