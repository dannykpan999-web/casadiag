# Videos del Hero

Este directorio debe contener el video de fondo del Hero section.

## Archivos requeridos

1. **hero-background.mp4** - Video principal (formato MP4, codec H.264)
2. **hero-background.webm** - Video alternativo (formato WebM, mejor compresion)

## Especificaciones del video

- **Duracion**: 15-20 segundos
- **Loop**: Si (el video debe poder reproducirse en bucle sin cortes bruscos)
- **Audio**: Sin audio (muted)
- **Resolucion**: 1920x1080 minimo (Full HD)
- **Framerate**: 24-30 fps
- **Bitrate**: 2-4 Mbps para web (optimizado)

## Contenido sugerido (segun briefing del cliente)

El video debe mostrar:
1. Patologias en viviendas (grietas, humedades visibles)
2. Tecnicos midiendo con instrumentos profesionales:
   - Fisurometro
   - Camara termica
   - Higrometro
3. Tecnico redactando informe
4. Breve plano de reparacion

## Tono visual

- Profesional y tecnico
- Colores neutros/grises con toques del color primario (teal)
- Sin texto superpuesto en el video
- Transiciones suaves entre escenas

## Poster (imagen de fallback)

Coloca tambien una imagen de poster en:
`/public/images/hero/hero-poster.webp`

Esta imagen se muestra mientras carga el video o si el video falla.

## Optimizacion

Para optimizar el video para web, puedes usar FFmpeg:

```bash
# Convertir a MP4 optimizado
ffmpeg -i input.mp4 -c:v libx264 -preset slow -crf 23 -c:a aac -b:a 128k -movflags +faststart hero-background.mp4

# Convertir a WebM
ffmpeg -i input.mp4 -c:v libvpx-vp9 -crf 30 -b:v 0 -c:a libopus -b:a 128k hero-background.webm
```

## Nota importante

El video actual es provisional. Una vez que tengas el video definitivo, reemplaza estos archivos manteniendo los mismos nombres.
