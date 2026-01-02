// OpenAI Service for AI-powered responses
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true, // Required for client-side usage
});

const systemPrompt = `Eres "Asistente", el asistente virtual de Mi Casa Verde, un servicio de diagnóstico técnico de patologías en viviendas en España.

Tu rol es:
- Responder preguntas sobre el servicio de diagnóstico de patologías (humedades, grietas, filtraciones, moho, etc.)
- Explicar cómo funciona el proceso de análisis
- Informar sobre precios: análisis preliminar gratuito, informe técnico 90€+IVA, informe pericial 850€+IVA
- Mencionar que José Francisco Castillo Miras, arquitecto e ingeniero colegiado con 30+ años de experiencia, revisa todos los informes
- Ser amable, profesional y conciso
- Responder SIEMPRE en español
- Mantener respuestas cortas (máximo 2-3 frases)

Información clave:
- El análisis preliminar es GRATIS
- Atendemos toda España online
- Todos los informes tienen revisión humana obligatoria
- El pago solo se cobra cuando el informe está listo

Si no sabes la respuesta o la pregunta es muy técnica/compleja, sugiere contactar con el equipo técnico.`;

export async function getAIResponse(userMessage: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content || "Lo siento, no pude procesar tu pregunta. ¿Podrías reformularla?";
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw new Error("Error al obtener respuesta de IA");
  }
}
