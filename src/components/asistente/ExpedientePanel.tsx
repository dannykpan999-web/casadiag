import { useState } from 'react';
import {
  Expediente,
  ExpedienteState,
  PackType,
  Evidence,
  getStateChecklist,
  canAdvanceToState,
} from '@/types/expediente';
import { Stepper } from './Stepper';
import { EvidenceUploader } from './EvidenceUploader';
import { PrediagnosticoBlock } from './PrediagnosticoBlock';
import { PacksSection } from './PacksSection';
import { PaymentModal } from './PaymentModal';
import { ResumenExpediente } from './ResumenExpediente';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  FileText,
  Upload,
  CreditCard,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExpedientePanelProps {
  expediente: Expediente;
  onUploadEvidence: (file: File) => Promise<Evidence>;
  onDeleteEvidence: (id: string) => void;
  onGeneratePrediagnostico: () => void;
  onSelectPack: (packId: PackType) => void;
  onAuthorizePayment: () => Promise<void>;
  onAdvanceState: () => void;
  className?: string;
}

export function ExpedientePanel({
  expediente,
  onUploadEvidence,
  onDeleteEvidence,
  onGeneratePrediagnostico,
  onSelectPack,
  onAuthorizePayment,
  onAdvanceState,
  className,
}: ExpedientePanelProps) {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [activeTab, setActiveTab] = useState('estado');

  const { estado, evidencias, prediagnostico, packSeleccionado, resumen } = expediente;
  const checklist = getStateChecklist(estado, expediente);

  const canGeneratePrediagnostico =
    estado === ExpedienteState.S2_EVIDENCIAS &&
    evidencias.filter((e) => e.type === 'photo' && e.status === 'completed').length >= 1;

  const canShowPacks =
    estado === ExpedienteState.S3_PREDIAGNOSTICO ||
    estado === ExpedienteState.S4_PACKS;

  const showPaymentSection =
    estado === ExpedienteState.S5_PAGO_AUTORIZACION;

  const showRevisionSection =
    estado === ExpedienteState.S6_REVISION_HUMANA ||
    estado === ExpedienteState.S7_ENVIADO;

  const handleSelectPack = (packId: PackType) => {
    onSelectPack(packId);
    if (packId !== 'orientacion') {
      setShowPaymentModal(true);
    }
  };

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Header */}
      <div className="border-b border-border bg-background px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Expediente</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
            {expediente.id.slice(0, 12)}...
          </span>
        </div>
        <Stepper currentState={estado} compact className="mt-3" />
      </div>

      {/* Content with tabs for mobile */}
      <div className="flex-1 overflow-hidden">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex h-full flex-col"
        >
          <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent px-4">
            <TabsTrigger value="estado" className="text-xs">
              Estado
            </TabsTrigger>
            <TabsTrigger value="evidencias" className="text-xs">
              Evidencias
            </TabsTrigger>
            <TabsTrigger value="resumen" className="text-xs">
              Resumen
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto">
            <TabsContent value="estado" className="m-0 h-full p-4">
              <div className="space-y-6">
                {/* Checklist */}
                <div>
                  <h4 className="mb-3 text-sm font-medium">Checklist actual</h4>
                  <div className="space-y-2">
                    {checklist.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        {item.completed ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span
                          className={cn(
                            item.completed
                              ? 'text-foreground'
                              : 'text-muted-foreground'
                          )}
                        >
                          {item.label}
                          {item.required && !item.completed && (
                            <span className="ml-1 text-destructive">*</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Prediagnostico */}
                {prediagnostico && (
                  <PrediagnosticoBlock prediagnostico={prediagnostico} />
                )}

                {/* Generate prediagnostico button */}
                {canGeneratePrediagnostico && !prediagnostico && (
                  <Button
                    variant="cta"
                    className="w-full"
                    onClick={onGeneratePrediagnostico}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Generar prediagnóstico
                  </Button>
                )}

                {/* Packs */}
                {canShowPacks && (
                  <PacksSection
                    selectedPack={packSeleccionado}
                    onSelectPack={handleSelectPack}
                  />
                )}

                {/* Payment section */}
                {showPaymentSection && (
                  <div className="space-y-4">
                    <div className="card-artistic group text-center">
                      {/* Shine sweep effect */}
                      <div className="card-artistic-shine" />

                      {/* Glow behind card */}
                      <div className="absolute -inset-[2px] bg-gradient-to-r from-primary/30 via-cyan-400/20 to-primary/30 rounded-[1.1rem] blur-sm opacity-60 -z-10 animate-pulse" />

                      <div className="card-artistic-content !p-5">
                        {/* Icon with glow */}
                        <div className="relative mx-auto w-14 h-14 mb-3">
                          <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-cyan-400/20 rounded-xl blur-md opacity-60 group-hover:opacity-100 transition-opacity duration-500" />
                          <div className="relative h-full w-full rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                            <CreditCard className="h-7 w-7 text-primary" />
                          </div>
                        </div>

                        <h4 className="card-artistic-title text-base font-semibold">
                          Autorización pendiente
                        </h4>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Completa el pago para continuar
                        </p>

                        <Button
                          variant="cta"
                          className="mt-4 btn-animated shadow-md shadow-primary/20"
                          onClick={() => setShowPaymentModal(true)}
                        >
                          Autorizar pago
                          <ArrowRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Revision section */}
                {showRevisionSection && (
                  <div className="card-artistic group">
                    {/* Shine sweep effect */}
                    <div className="card-artistic-shine" />

                    {/* Amber glow behind card */}
                    <div className="absolute -inset-[2px] bg-gradient-to-r from-amber-400/30 via-orange-400/20 to-amber-400/30 rounded-[1.1rem] blur-sm opacity-50 -z-10 animate-pulse" />

                    <div className="card-artistic-content !p-5 text-center">
                      {/* Icon with glow */}
                      <div className="relative mx-auto w-14 h-14 mb-3">
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/30 to-orange-400/20 rounded-xl blur-md opacity-60 group-hover:opacity-100 transition-opacity duration-500 animate-pulse" />
                        <div className="relative h-full w-full rounded-xl bg-gradient-to-br from-amber-500/15 to-amber-500/5 dark:from-amber-500/20 dark:to-amber-500/10 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                          <Clock className="h-7 w-7 text-amber-600 dark:text-amber-400" />
                        </div>
                      </div>

                      <h4 className="text-base font-semibold text-amber-800 dark:text-amber-300 group-hover:text-amber-700 dark:group-hover:text-amber-200 transition-colors duration-300">
                        En revisión humana
                      </h4>
                      <p className="mt-1 text-sm text-amber-700/80 dark:text-amber-400/80 leading-relaxed">
                        Tu expediente está siendo revisado por un profesional.
                        Recibirás el informe una vez validado.
                      </p>

                      {/* Progress indicator */}
                      <div className="mt-4 flex items-center justify-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                        <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" style={{ animationDelay: '150ms' }} />
                        <span className="h-2 w-2 rounded-full bg-amber-300 dark:bg-amber-500/70 animate-pulse" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Stepper full */}
                <div>
                  <h4 className="mb-3 text-sm font-medium">Progreso completo</h4>
                  <Stepper currentState={estado} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="evidencias" className="m-0 h-full p-4">
              <EvidenceUploader
                evidencias={evidencias}
                onUpload={onUploadEvidence}
                onDelete={onDeleteEvidence}
              />
            </TabsContent>

            <TabsContent value="resumen" className="m-0 h-full p-4">
              <ResumenExpediente resumen={resumen} />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Disclaimer footer */}
      <div className="border-t border-border bg-muted/30 px-4 py-2">
        <p className="text-center text-xs text-muted-foreground">
          Revisión humana obligatoria antes del envío
        </p>
      </div>

      {/* Payment modal */}
      {packSeleccionado && packSeleccionado !== 'orientacion' && (
        <PaymentModal
          open={showPaymentModal}
          onOpenChange={setShowPaymentModal}
          packId={packSeleccionado}
          onAuthorize={onAuthorizePayment}
        />
      )}
    </div>
  );
}
