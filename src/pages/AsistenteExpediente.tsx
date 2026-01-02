import { useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useExpediente } from '@/hooks/useExpediente';
import { ChatPanel } from '@/components/asistente/ChatPanel';
import { ExpedientePanel } from '@/components/asistente/ExpedientePanel';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AsistenteExpediente() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    expediente,
    loading,
    error,
    sendMessage,
    uploadEvidence,
    deleteEvidence,
    generatePrediagnostico,
    selectPack,
    authorizePayment,
    advanceState,
  } = useExpediente(id);

  const handleAuthorizePayment = async () => {
    try {
      await authorizePayment();
      navigate('/asistente/confirmacion');
    } catch (error) {
      toast.error('Error al autorizar el pago. Por favor, inténtalo de nuevo.');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !expediente) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <p className="text-muted-foreground">{error || 'Expediente no encontrado'}</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link to="/asistente">Volver al inicio</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background">
        <div className="container flex h-14 items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
              <span className="text-xs font-bold text-primary-foreground">DT</span>
            </div>
            <span className="font-semibold text-sm">Diagnóstico Técnico</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex flex-1 overflow-hidden">
        {/* Chat - Left side on desktop, full on mobile */}
        <div className="flex flex-1 flex-col lg:w-1/2 lg:border-r lg:border-border">
          <ChatPanel
            messages={expediente.messages}
            estado={expediente.estado}
            onSendMessage={sendMessage}
            onAttachFile={() => fileInputRef.current?.click()}
            className="h-full"
          />
        </div>

        {/* Expediente Panel - Right side on desktop, hidden on mobile (accessed via tabs in ChatPanel) */}
        <div className="hidden lg:flex lg:w-1/2 lg:flex-col">
          <ExpedientePanel
            expediente={expediente}
            onUploadEvidence={uploadEvidence}
            onDeleteEvidence={deleteEvidence}
            onGeneratePrediagnostico={generatePrediagnostico}
            onSelectPack={selectPack}
            onAuthorizePayment={handleAuthorizePayment}
            onAdvanceState={advanceState}
            className="h-full"
          />
        </div>

        {/* Mobile: Bottom sheet or tabs for expediente - simplified for now */}
        <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background p-2 lg:hidden">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
          >
            Subir evidencia
          </Button>
        </div>
      </main>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/mp4,video/quicktime"
        onChange={(e) => {
          if (e.target.files) {
            Array.from(e.target.files).forEach(uploadEvidence);
          }
        }}
        className="hidden"
      />
    </div>
  );
}
