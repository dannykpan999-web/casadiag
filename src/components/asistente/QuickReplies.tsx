import { ExpedienteState } from '@/types/expediente';
import { Button } from '@/components/ui/button';

interface QuickRepliesProps {
  estado: ExpedienteState;
  onSelect: (reply: string) => void;
}

const QUICK_REPLIES: Partial<Record<ExpedienteState, string[]>> = {
  [ExpedienteState.S1_CONTEXTO]: [
    'Humedad',
    'Grietas',
    'Moho',
    'Filtración',
    'Goteras',
    'No estoy seguro',
  ],
  [ExpedienteState.S2_EVIDENCIAS]: [
    'Ya he subido todas las fotos',
    'Añadiré más evidencias',
    'Tengo vídeo del problema',
  ],
  [ExpedienteState.S3_PREDIAGNOSTICO]: [
    'Entendido, gracias',
    'Tengo dudas sobre el diagnóstico',
    'Quiero solicitar informe',
  ],
};

export function QuickReplies({ estado, onSelect }: QuickRepliesProps) {
  const replies = QUICK_REPLIES[estado];

  if (!replies || replies.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {replies.map((reply) => (
        <Button
          key={reply}
          variant="outline"
          size="sm"
          className="h-auto px-3 py-1.5 text-xs"
          onClick={() => onSelect(reply)}
        >
          {reply}
        </Button>
      ))}
    </div>
  );
}
