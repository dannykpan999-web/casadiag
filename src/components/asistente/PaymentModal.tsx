import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PACKS, PackType } from '@/types/expediente';
import { CreditCard, Shield, AlertCircle, Loader2 } from 'lucide-react';

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packId: PackType;
  onAuthorize: () => Promise<void>;
}

export function PaymentModal({
  open,
  onOpenChange,
  packId,
  onAuthorize,
}: PaymentModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pack = PACKS.find((p) => p.id === packId);

  const handleAuthorize = async () => {
    setLoading(true);
    setError(null);

    try {
      await onAuthorize();
      onOpenChange(false);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Error desconocido';
      console.warn('Payment authorization failed:', errorMessage);
      setError('Error al procesar la autorización. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  if (!pack) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Autorizar pago</DialogTitle>
          <DialogDescription>
            Pack seleccionado: {pack.nombre}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Price */}
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-center">
            <p className="text-sm text-muted-foreground">Importe</p>
            <p className="text-3xl font-bold">{pack.precio}</p>
          </div>

          {/* Explanation */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CreditCard className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Se autoriza ahora</p>
                <p className="text-sm text-muted-foreground">
                  Tu banco reserva el importe pero no se cobra todavía
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Shield className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Se captura al entregar</p>
                <p className="text-sm text-muted-foreground">
                  El cargo solo se realiza cuando el informe ha sido revisado y enviado
                </p>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Trust note */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs text-amber-800">
              <strong>Revisión humana obligatoria.</strong> Ningún informe se envía
              sin validación por parte de un profesional.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            variant="cta"
            className="w-full"
            onClick={handleAuthorize}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Autorizar pago
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
