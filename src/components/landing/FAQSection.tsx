import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const faqs = [
  {
    question: "¿Qué problemas cubre este servicio?",
    answer:
      "Ofrecemos orientación técnica para ayudarte a entender las patologías más comunes en viviendas, como: fisuras finas en paredes (superficiales o con posible origen estructural), humedades, moho por condensación, filtraciones de agua, fugas, y daños en acabados e instalaciones relacionados con la humedad. El asistente identifica causas probables, evalúa la urgencia y te indica los pasos a seguir, sin alarmismos ni reparaciones innecesarias.",
  },
  {
    question: "¿Qué evidencia debo subir?",
    answer:
      "Puedes subir hasta 10 fotos nítidas y bien iluminadas de la zona afectada y 1–2 vídeos cortos opcionales para dar contexto. La evidencia debe evitar el desenfoque y los primeros planos excesivos. Si hay fisuras, deben verse finas y reales: la IA no las exagerará. Cuanto más clara sea la evidencia, más preciso será el análisis.",
  },
  {
    question: "¿Cuánto tiempo tarda el proceso?",
    answer:
      "El análisis guiado del asistente suele tardar 3 a 5 minutos. Si después solicitas el pack con informe PDF firmado, la revisión humana y la entrega digital se realizan en menos de 24 horas, dependiendo de la carga de trabajo y de la calidad de la evidencia aportada.",
  },
  {
    question: "¿El informe se envía automáticamente?",
    answer:
      "No. Todos los informes PDF de pago son revisados, validados y firmados digitalmente por un técnico colegiado antes de entregarse. El asistente te da una primera orientación gratuita en pantalla, pero ningún informe se emite sin revisión experta obligatoria.",
  },
  {
    question: "¿Cómo funciona el pago?",
    answer:
      "Solo pagas si decides continuar tras el análisis gratuito. En el pack de 90 € + IVA, el pago se autoriza al solicitar el informe, pero solo se cobra tras la entrega. Recibirás siempre justificante de contratación del servicio y comprobante de pago. El procesamiento es seguro y cumple con RGPD.",
  },
  {
    question: "¿Qué pasa con mis datos y evidencias?",
    answer:
      "Tus datos y archivos se tratan de forma segura y cifrada, se usan únicamente para el análisis y el informe, con control de acceso, y se eliminan o anonimizan tras el procesamiento según la política de retención. No compartimos información con terceros sin fundamento legal o consentimiento.",
  },
  {
    question: "¿Puedo usarlo como abogado o administrador de fincas?",
    answer:
      "Sí. El servicio adapta el enfoque para ayudar a: abogados que necesitan evidencias técnicas y un informe con estructura profesional para procesos legales o seguros, y administradores de fincas que requieren documentar incidencias recurrentes con trazabilidad. Los resultados son rigurosos y organizados para flujos de trabajo profesionales.",
  },
];

export function FAQSection() {
  const { ref: headerRef, isVisible: headerVisible } = useScrollAnimation<HTMLDivElement>({
    threshold: 0.3,
  });
  const { ref: accordionRef, isVisible: accordionVisible } = useScrollAnimation<HTMLDivElement>({
    threshold: 0.1,
  });

  return (
    <section id="preguntas" className="section">
      <div className="container">
        <div
          ref={headerRef}
          className={`section-header transition-all duration-600 ease-out ${
            headerVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <h2 className="section-title">Preguntas frecuentes</h2>
          <p className="section-subtitle">
            Resolvemos las dudas más habituales sobre el servicio
          </p>
        </div>

        <div ref={accordionRef} className="mx-auto max-w-3xl">
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className={`card-institutional card-glow overflow-hidden border px-0 transition-all duration-500 ease-out ${
                  accordionVisible
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-6"
                }`}
                style={{ transitionDelay: accordionVisible ? `${index * 80}ms` : "0ms" }}
              >
                <AccordionTrigger className="px-4 md:px-6 py-3 md:py-4 text-left hover:no-underline [&[data-state=open]]:bg-accent/50 transition-colors duration-200">
                  <span className="font-medium text-sm md:text-base">{faq.question}</span>
                </AccordionTrigger>
                <AccordionContent className="px-4 md:px-6 pb-3 md:pb-4 pt-2 text-xs md:text-sm text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
