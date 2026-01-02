import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Expediente,
  ExpedienteState,
  UserProfile,
  Message,
  Evidence,
  Prediagnostico,
  PackType,
  canAdvanceToState,
} from '@/types/expediente';
import {
  createExpediente,
  getExpediente,
  saveExpediente,
  addMessage,
  addEvidence,
  updateEvidenceStatus,
  removeEvidence,
  generateMessageId,
} from '@/lib/expediente-storage';

// Track blob URLs for cleanup to prevent memory leaks
const blobUrlRegistry = new Map<string, string>();

// Revoke a blob URL and remove it from registry
const revokeBlobUrl = (evidenceId: string): void => {
  const url = blobUrlRegistry.get(evidenceId);
  if (url) {
    URL.revokeObjectURL(url);
    blobUrlRegistry.delete(evidenceId);
  }
};

// Register a blob URL for later cleanup
const registerBlobUrl = (evidenceId: string, url: string): void => {
  blobUrlRegistry.set(evidenceId, url);
};

interface UseExpedienteReturn {
  expediente: Expediente | null;
  loading: boolean;
  error: string | null;
  // Actions
  initExpediente: (perfil: UserProfile) => Expediente;
  loadExpediente: (id: string) => void;
  sendMessage: (content: string, attachments?: string[]) => void;
  uploadEvidence: (file: File) => Promise<Evidence>;
  deleteEvidence: (evidenceId: string) => void;
  updateResumen: (resumen: Partial<Expediente['resumen']>) => void;
  advanceState: () => boolean;
  selectPack: (packId: PackType) => void;
  authorizePayment: () => Promise<void>;
  generatePrediagnostico: () => void;
}

// Mock assistant responses based on context
const generateAssistantResponse = (
  expediente: Expediente,
  userMessage: string
): string => {
  const { perfil, estado, resumen, evidencias } = expediente;

  const tono = {
    particular: { style: 'cercano', formal: false },
    abogado: { style: 'formal', formal: true },
    administrador: { style: 'profesional', formal: true },
  }[perfil];

  // Detect keywords for auto-filling resumen
  const lowerMessage = userMessage.toLowerCase();
  
  // Location detection
  const ubicaciones = ['cocina', 'baño', 'dormitorio', 'salón', 'terraza', 'cubierta', 'fachada', 'sótano', 'garaje'];
  const ubicacionDetectada = ubicaciones.find(u => lowerMessage.includes(u));

  // Problem type detection
  const patologias = [
    { keywords: ['humedad', 'húmedo', 'agua', 'mojado'], tipo: 'Humedad / filtración' },
    { keywords: ['grieta', 'fisura', 'rajada'], tipo: 'Grietas / fisuras' },
    { keywords: ['moho', 'hongos', 'negro', 'manchas negras'], tipo: 'Moho / condensación' },
    { keywords: ['goteo', 'gotera', 'filtra'], tipo: 'Filtración activa' },
    { keywords: ['desprendimiento', 'cae', 'caído'], tipo: 'Desprendimiento' },
  ];
  const patologiaDetectada = patologias.find(p => p.keywords.some(k => lowerMessage.includes(k)));

  // Time detection
  const tiempoPatterns = [
    { pattern: /hace (\d+) (día|días|semana|semanas|mes|meses|año|años)/i, extract: true },
    { pattern: /desde hace/i, extract: false },
    { pattern: /recientemente/i, value: 'Reciente (días)' },
    { pattern: /siempre|mucho tiempo/i, value: 'Prolongado' },
  ];

  // Generate contextual response
  if (estado === ExpedienteState.S1_CONTEXTO) {
    if (!resumen.descripcionUsuario && userMessage.length > 20) {
      if (tono.formal) {
        return `Entendido. He registrado la descripción inicial del problema.${ubicacionDetectada ? ` Ubicación identificada: ${ubicacionDetectada}.` : ''
          }${patologiaDetectada ? ` Patología probable: ${patologiaDetectada.tipo}.` : ''
          }

Para completar el contexto inicial, ¿podría indicar desde cuándo observa estos síntomas? También resulta útil saber si ha habido episodios anteriores similares o si se han realizado reparaciones previas.`;
      } else {
        return `Gracias por la descripción.${ubicacionDetectada ? ` Veo que está en ${ubicacionDetectada}.` : ''
          }${patologiaDetectada ? ` Parece que podría tratarse de ${patologiaDetectada.tipo.toLowerCase()}.` : ''
          }

¿Desde cuándo notas este problema? ¿Ha ido a más con el tiempo o se mantiene igual?`;
      }
    }

    if (resumen.descripcionUsuario && !resumen.antiguedad) {
      return tono.formal
        ? 'Perfecto. Una vez indicada la antigüedad del problema, podremos pasar a la recopilación de evidencias fotográficas.'
        : 'Bien, ya casi tenemos el contexto completo. Cuando me digas desde cuándo lo notas, pasaremos a subir fotos del problema.';
    }

    const photosCount = evidencias.filter(e => e.type === 'photo' && e.status === 'completed').length;
    if (photosCount === 0) {
      return tono.formal
        ? 'El contexto inicial está registrado. Ahora necesitamos evidencia fotográfica. Por favor, adjunte imágenes claras de la zona afectada utilizando el panel de evidencias.'
        : 'Ya tengo una idea del problema. Ahora necesito ver fotos de la zona afectada. Puedes subirlas desde el panel de la derecha o adjuntarlas aquí directamente.';
    }
  }

  if (estado === ExpedienteState.S2_EVIDENCIAS) {
    const photosCount = evidencias.filter(e => e.type === 'photo' && e.status === 'completed').length;
    const videosCount = evidencias.filter(e => e.type === 'video' && e.status === 'completed').length;

    if (photosCount >= 1 && photosCount < 3) {
      return tono.formal
        ? `Se han recibido ${photosCount} fotografía(s). Para un análisis más preciso, se recomienda disponer de 3-6 imágenes que muestren diferentes ángulos y detalles de la patología.`
        : `Ya tengo ${photosCount} foto(s). Si puedes subir alguna más desde otro ángulo o con más detalle, el análisis será más preciso. Lo ideal son entre 3 y 6 fotos.`;
    }

    if (photosCount >= 3) {
      return tono.formal
        ? `Evidencia fotográfica suficiente (${photosCount} imágenes).${videosCount > 0 ? ` Vídeo(s) adjunto(s): ${videosCount}.` : ''
        } Cuando esté listo, puede solicitar el prediagnóstico preliminar.`
        : `Perfecto, ya tenemos ${photosCount} fotos${videosCount > 0 ? ` y ${videosCount} vídeo(s)` : ''
        }. Cuando quieras, podemos generar el prediagnóstico preliminar.`;
    }
  }

  // Default contextual response
  return tono.formal
    ? 'Información registrada. ¿Desea añadir algún detalle adicional o procedemos con el siguiente paso?'
    : '¡Anotado! ¿Hay algo más que quieras contarme o pasamos al siguiente paso?';
};

export const useExpediente = (expedienteId?: string): UseExpedienteReturn => {
  const [expediente, setExpediente] = useState<Expediente | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadExpediente = useCallback((id: string) => {
    setLoading(true);
    setError(null);
    try {
      const exp = getExpediente(id);
      if (exp) {
        setExpediente(exp);
      } else {
        setError('Expediente no encontrado');
      }
    } catch (e) {
      setError('Error al cargar el expediente');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load expediente on mount or when ID changes
  useEffect(() => {
    if (expedienteId) {
      loadExpediente(expedienteId);
    }
  }, [expedienteId, loadExpediente]);

  const initExpediente = useCallback((perfil: UserProfile): Expediente => {
    const exp = createExpediente(perfil);
    setExpediente(exp);
    return exp;
  }, []);

  const sendMessage = useCallback((content: string, attachments?: string[]) => {
    if (!expediente) return;

    // Add user message
    const userMsg = addMessage(expediente.id, {
      role: 'user',
      content,
      attachments,
    });

    // Update local state
    const updatedExp = getExpediente(expediente.id)!;

    // Auto-detect and update resumen from message
    const lowerContent = content.toLowerCase();
    const updates: Partial<Expediente['resumen']> = {};

    if (!updatedExp.resumen.descripcionUsuario && content.length > 20) {
      updates.descripcionUsuario = content;
    }

    // Location detection
    const ubicaciones = ['cocina', 'baño', 'dormitorio', 'salón', 'terraza', 'cubierta', 'fachada', 'sótano', 'garaje'];
    const ubicacionDetectada = ubicaciones.find(u => lowerContent.includes(u));
    if (ubicacionDetectada && !updatedExp.resumen.ubicacion) {
      updates.ubicacion = ubicacionDetectada.charAt(0).toUpperCase() + ubicacionDetectada.slice(1);
    }

    // Time detection
    const timeMatch = content.match(/hace (\d+) (día|días|semana|semanas|mes|meses|año|años)/i);
    if (timeMatch && !updatedExp.resumen.antiguedad) {
      updates.antiguedad = timeMatch[0];
    }

    if (Object.keys(updates).length > 0) {
      updatedExp.resumen = { ...updatedExp.resumen, ...updates };
      saveExpediente(updatedExp);
    }

    // Capture current expediente ID to avoid stale closure
    const currentExpedienteId = expediente.id;

    // Generate and add assistant response
    setTimeout(() => {
      try {
        const currentExp = getExpediente(currentExpedienteId);
        if (!currentExp) return; // Guard against deleted expediente

        const response = generateAssistantResponse(currentExp, content);
        addMessage(currentExpedienteId, {
          role: 'assistant',
          content: response,
        });
        setExpediente(getExpediente(currentExpedienteId));
      } catch (error) {
        // Silently handle error if expediente was deleted
      }
    }, 500);

    setExpediente(getExpediente(expediente.id));
  }, [expediente]);

  const uploadEvidence = useCallback(async (file: File): Promise<Evidence> => {
    if (!expediente) throw new Error('No expediente loaded');

    const type: Evidence['type'] = file.type.startsWith('image/')
      ? 'photo'
      : file.type.startsWith('video/')
        ? 'video'
        : file.type.startsWith('audio/')
          ? 'audio'
          : 'document';

    const evidence = addEvidence(expediente.id, {
      type,
      name: file.name,
      size: file.size,
      mimeType: file.type,
      status: 'uploading',
    });

    setExpediente(getExpediente(expediente.id));

    // Simulate upload
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1000));

    // Create object URL for preview and register for cleanup
    const url = URL.createObjectURL(file);
    registerBlobUrl(evidence.id, url);
    updateEvidenceStatus(expediente.id, evidence.id, 'completed', url);

    const updatedExp = getExpediente(expediente.id)!;
    setExpediente(updatedExp);

    // Auto-advance to S2 if we have context and this is first evidence
    if (updatedExp.estado === ExpedienteState.S1_CONTEXTO && updatedExp.resumen.descripcionUsuario) {
      updatedExp.estado = ExpedienteState.S2_EVIDENCIAS;
      saveExpediente(updatedExp);
      setExpediente(getExpediente(expediente.id));
    }

    return { ...evidence, status: 'completed', url };
  }, [expediente]);

  const deleteEvidence = useCallback((evidenceId: string) => {
    if (!expediente) return;
    // Revoke blob URL to prevent memory leak
    revokeBlobUrl(evidenceId);
    removeEvidence(expediente.id, evidenceId);
    setExpediente(getExpediente(expediente.id));
  }, [expediente]);

  const updateResumen = useCallback((resumen: Partial<Expediente['resumen']>) => {
    if (!expediente) return;
    expediente.resumen = { ...expediente.resumen, ...resumen };
    saveExpediente(expediente);
    setExpediente(getExpediente(expediente.id));
  }, [expediente]);

  const generatePrediagnostico = useCallback(() => {
    if (!expediente) return;

    const { resumen, evidencias } = expediente;

    // Generate mock prediagnostico based on resumen
    const prediagnostico: Prediagnostico = {
      hipotesis: [
        resumen.tipoPatologia || 'Posible problema de humedad o filtración',
        'Podría estar relacionado con deficiencias en el aislamiento o impermeabilización',
        'Considerar revisión de instalaciones cercanas (fontanería, saneamiento)',
      ],
      posiblesCausas: [
        'Infiltración desde el exterior (cubierta, fachada, terraza)',
        'Condensación por falta de ventilación o puentes térmicos',
        'Fuga en instalaciones de fontanería o saneamiento',
        'Capilaridad ascendente desde cimentación',
      ],
      proximosPasos: [
        'Documentar la evolución del problema (fotos periódicas)',
        'Verificar estado de impermeabilización en zonas superiores',
        'Comprobar ventilación de la estancia afectada',
        'Considerar inspección presencial si persiste o empeora',
      ],
      riesgoPercibido: evidencias.length > 3 ? 'medio' : 'bajo',
    };

    if (evidencias.filter(e => e.type === 'photo').length < 3) {
      prediagnostico.evidenciaAdicionalSugerida =
        'Fotografías adicionales de: zonas colindantes, detalle de manchas/grietas, posibles puntos de entrada de agua.';
    }

    expediente.prediagnostico = prediagnostico;
    expediente.estado = ExpedienteState.S3_PREDIAGNOSTICO;
    saveExpediente(expediente);

    // Add assistant message about prediagnostico
    addMessage(expediente.id, {
      role: 'assistant',
      content: `He generado el prediagnóstico preliminar basándome en la información y evidencias proporcionadas. Puedes verlo en el panel de la derecha.

Recuerda que esta es una orientación preliminar que no sustituye una inspección presencial cuando sea necesaria.

Si deseas un informe técnico revisado por un profesional, puedes seleccionar uno de los packs disponibles en el siguiente paso.`,
    });

    setExpediente(getExpediente(expediente.id));
  }, [expediente]);

  const advanceState = useCallback((): boolean => {
    if (!expediente) return false;

    const states = Object.values(ExpedienteState);
    const currentIndex = states.indexOf(expediente.estado);
    const nextState = states[currentIndex + 1];

    if (!nextState) return false;

    if (canAdvanceToState(expediente.estado, nextState, expediente)) {
      expediente.estado = nextState;
      saveExpediente(expediente);
      setExpediente(getExpediente(expediente.id));
      return true;
    }

    return false;
  }, [expediente]);

  const selectPack = useCallback((packId: PackType) => {
    if (!expediente) return;

    expediente.packSeleccionado = packId;

    if (packId === 'orientacion') {
      // Free pack - stay at S4
      addMessage(expediente.id, {
        role: 'assistant',
        content: 'Has seleccionado la orientación preliminar gratuita. Ya dispones del prediagnóstico en pantalla con las hipótesis, posibles causas y próximos pasos recomendados.',
      });
    } else {
      // Paid pack - advance to S5
      expediente.estado = ExpedienteState.S5_PAGO_AUTORIZACION;
      addMessage(expediente.id, {
        role: 'assistant',
        content: `Has seleccionado el pack "${packId === 'informe' ? 'Informe técnico revisado' : 'Prioridad / Segunda opinión'}". 

Para continuar, necesitamos autorizar el pago. Recuerda: se autoriza ahora, pero el cargo solo se realiza cuando el informe haya sido revisado y enviado.`,
      });
    }

    saveExpediente(expediente);
    setExpediente(getExpediente(expediente.id));
  }, [expediente]);

  const authorizePayment = useCallback(async () => {
    if (!expediente) return;

    // Simulate payment authorization
    await new Promise((resolve) => setTimeout(resolve, 1500));

    expediente.payment = {
      id: `pay_${Date.now()}`,
      expedienteId: expediente.id,
      packId: expediente.packSeleccionado!,
      status: 'authorized',
      authorizedAt: new Date(),
    };
    expediente.estado = ExpedienteState.S6_REVISION_HUMANA;

    saveExpediente(expediente);
    setExpediente(getExpediente(expediente.id));
  }, [expediente]);

  return {
    expediente,
    loading,
    error,
    initExpediente,
    loadExpediente,
    sendMessage,
    uploadEvidence,
    deleteEvidence,
    updateResumen,
    advanceState,
    selectPack,
    authorizePayment,
    generatePrediagnostico,
  };
};
