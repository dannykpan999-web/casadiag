// Estados del expediente (state machine)
export enum ExpedienteState {
  S0_PERFIL = 'S0_PERFIL',
  S1_CONTEXTO = 'S1_CONTEXTO',
  S2_EVIDENCIAS = 'S2_EVIDENCIAS',
  S3_PREDIAGNOSTICO = 'S3_PREDIAGNOSTICO',
  S4_PACKS = 'S4_PACKS',
  S5_PAGO_AUTORIZACION = 'S5_PAGO_AUTORIZACION',
  S6_REVISION_HUMANA = 'S6_REVISION_HUMANA',
  S7_ENVIADO = 'S7_ENVIADO',
  S8_CERRADO = 'S8_CERRADO',
}

export const STATE_LABELS: Record<ExpedienteState, string> = {
  [ExpedienteState.S0_PERFIL]: 'Perfil',
  [ExpedienteState.S1_CONTEXTO]: 'Contexto',
  [ExpedienteState.S2_EVIDENCIAS]: 'Evidencias',
  [ExpedienteState.S3_PREDIAGNOSTICO]: 'Prediagnóstico',
  [ExpedienteState.S4_PACKS]: 'Selección de pack',
  [ExpedienteState.S5_PAGO_AUTORIZACION]: 'Autorización de pago',
  [ExpedienteState.S6_REVISION_HUMANA]: 'En revisión',
  [ExpedienteState.S7_ENVIADO]: 'Enviado',
  [ExpedienteState.S8_CERRADO]: 'Cerrado',
};

export type UserProfile = 'particular' | 'abogado' | 'administrador';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  attachments?: string[];
}

export interface Evidence {
  id: string;
  type: 'photo' | 'video' | 'audio' | 'document';
  name: string;
  size: number;
  mimeType: string;
  url?: string;
  thumbnailUrl?: string;
  status: 'uploading' | 'completed' | 'error';
  uploadedAt: Date;
}

export interface Prediagnostico {
  hipotesis: string[];
  posiblesCausas: string[];
  proximosPasos: string[];
  evidenciaAdicionalSugerida?: string;
  riesgoPercibido: 'bajo' | 'medio' | 'alto';
}

export interface ResumenExpediente {
  tipoPatologia?: string;
  ubicacion?: string;
  antiguedad?: string;
  sintomasObservados?: string[];
  descripcionUsuario?: string;
}

export type PackType = 'orientacion' | 'informe' | 'prioridad';

export interface Pack {
  id: PackType;
  nombre: string;
  descripcion: string;
  precio: string;
  incluye: string[];
  destacado?: boolean;
}

export interface Payment {
  id: string;
  expedienteId: string;
  packId: PackType;
  status: 'pending' | 'authorized' | 'captured' | 'cancelled';
  authorizedAt?: Date;
  capturedAt?: Date;
}

export interface Expediente {
  id: string;
  perfil: UserProfile;
  estado: ExpedienteState;
  messages: Message[];
  evidencias: Evidence[];
  resumen: ResumenExpediente;
  prediagnostico?: Prediagnostico;
  packSeleccionado?: PackType;
  payment?: Payment;
  consentimientoRGPD: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  required: boolean;
}

export const PACKS: Pack[] = [
  {
    id: 'orientacion',
    nombre: 'Orientación preliminar',
    descripcion: 'Chat guiado + recopilación + prediagnóstico en pantalla',
    precio: 'Gratis',
    incluye: [
      'Asistente guiado paso a paso',
      'Recopilación de evidencias',
      'Prediagnóstico en pantalla',
      'Checklist de próximos pasos',
    ],
  },
  {
    id: 'informe',
    nombre: 'Informe técnico revisado',
    descripcion: 'Borrador automático + revisión humana + envío PDF',
    precio: '49€',
    incluye: [
      'Todo lo del pack gratuito',
      'Borrador de informe generado',
      'Revisión humana obligatoria',
      'Informe PDF enviado por email',
      'Recomendaciones detalladas',
    ],
    destacado: true,
  },
  {
    id: 'prioridad',
    nombre: 'Prioridad / Segunda opinión',
    descripcion: 'Revisión prioritaria + aclaraciones + recomendaciones ampliadas',
    precio: '89€',
    incluye: [
      'Todo lo del informe técnico',
      'Revisión prioritaria (24-48h)',
      'Aclaraciones adicionales',
      'Recomendaciones ampliadas',
      'Seguimiento del caso',
    ],
  },
];

// Validaciones por estado
export const getStateChecklist = (
  estado: ExpedienteState,
  expediente: Expediente
): ChecklistItem[] => {
  const baseChecklist: Record<ExpedienteState, ChecklistItem[]> = {
    [ExpedienteState.S0_PERFIL]: [
      {
        id: 'perfil',
        label: 'Perfil seleccionado',
        completed: !!expediente.perfil,
        required: true,
      },
      {
        id: 'consentimiento',
        label: 'Consentimiento RGPD aceptado',
        completed: expediente.consentimientoRGPD,
        required: true,
      },
    ],
    [ExpedienteState.S1_CONTEXTO]: [
      {
        id: 'descripcion',
        label: 'Descripción inicial del problema',
        completed: !!expediente.resumen.descripcionUsuario,
        required: true,
      },
      {
        id: 'ubicacion',
        label: 'Ubicación indicada',
        completed: !!expediente.resumen.ubicacion,
        required: false,
      },
      {
        id: 'antiguedad',
        label: 'Antigüedad del problema',
        completed: !!expediente.resumen.antiguedad,
        required: false,
      },
    ],
    [ExpedienteState.S2_EVIDENCIAS]: [
      {
        id: 'fotos_min',
        label: 'Mínimo 1 foto subida',
        completed: expediente.evidencias.filter((e) => e.type === 'photo' && e.status === 'completed').length >= 1,
        required: true,
      },
      {
        id: 'fotos_ideal',
        label: 'Fotos ideales (3-6)',
        completed: expediente.evidencias.filter((e) => e.type === 'photo' && e.status === 'completed').length >= 3,
        required: false,
      },
      {
        id: 'video',
        label: 'Vídeo adjunto (opcional)',
        completed: expediente.evidencias.filter((e) => e.type === 'video' && e.status === 'completed').length >= 1,
        required: false,
      },
    ],
    [ExpedienteState.S3_PREDIAGNOSTICO]: [
      {
        id: 'prediagnostico',
        label: 'Prediagnóstico generado',
        completed: !!expediente.prediagnostico,
        required: true,
      },
    ],
    [ExpedienteState.S4_PACKS]: [
      {
        id: 'pack',
        label: 'Pack seleccionado',
        completed: !!expediente.packSeleccionado,
        required: true,
      },
    ],
    [ExpedienteState.S5_PAGO_AUTORIZACION]: [
      {
        id: 'pago',
        label: 'Pago autorizado',
        completed: expediente.payment?.status === 'authorized',
        required: true,
      },
    ],
    [ExpedienteState.S6_REVISION_HUMANA]: [
      {
        id: 'revision',
        label: 'En cola de revisión',
        completed: true,
        required: true,
      },
    ],
    [ExpedienteState.S7_ENVIADO]: [
      {
        id: 'enviado',
        label: 'Informe enviado',
        completed: true,
        required: true,
      },
    ],
    [ExpedienteState.S8_CERRADO]: [
      {
        id: 'cerrado',
        label: 'Expediente cerrado',
        completed: true,
        required: true,
      },
    ],
  };

  return baseChecklist[estado] || [];
};

export const canAdvanceToState = (
  currentState: ExpedienteState,
  targetState: ExpedienteState,
  expediente: Expediente
): boolean => {
  const stateOrder = Object.values(ExpedienteState);
  const currentIndex = stateOrder.indexOf(currentState);
  const targetIndex = stateOrder.indexOf(targetState);

  if (targetIndex <= currentIndex) return true;
  if (targetIndex > currentIndex + 1) return false;

  const checklist = getStateChecklist(currentState, expediente);
  const requiredItems = checklist.filter((item) => item.required);
  return requiredItems.every((item) => item.completed);
};
