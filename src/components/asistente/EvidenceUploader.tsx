import { useState, useRef, useCallback } from 'react';
import { Evidence } from '@/types/expediente';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Upload,
  Image,
  Video,
  File,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface EvidenceUploaderProps {
  evidencias: Evidence[];
  onUpload: (file: File) => Promise<Evidence>;
  onDelete: (id: string) => void;
  className?: string;
}

const MAX_PHOTOS = 10;
const MAX_VIDEOS = 2;
const MAX_VIDEO_SIZE_MB = 200;
const ALLOWED_VIDEO_FORMATS = ['video/mp4', 'video/quicktime', 'video/mov'];
const ALLOWED_IMAGE_FORMATS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

export function EvidenceUploader({
  evidencias,
  onUpload,
  onDelete,
  className,
}: EvidenceUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const photosCount = evidencias.filter((e) => e.type === 'photo').length;
  const videosCount = evidencias.filter((e) => e.type === 'video').length;
  const totalVideoSize = evidencias
    .filter((e) => e.type === 'video')
    .reduce((acc, e) => acc + e.size, 0);

  const validateFile = useCallback((file: File): string | null => {
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (isImage) {
      if (photosCount >= MAX_PHOTOS) {
        return `Máximo ${MAX_PHOTOS} fotos permitidas`;
      }
      if (!ALLOWED_IMAGE_FORMATS.some((f) => file.type.includes(f.split('/')[1]))) {
        return 'Formato de imagen no soportado. Usa JPG, PNG o WebP';
      }
    }

    if (isVideo) {
      if (videosCount >= MAX_VIDEOS) {
        return `Máximo ${MAX_VIDEOS} vídeos permitidos`;
      }
      if (!ALLOWED_VIDEO_FORMATS.includes(file.type)) {
        return 'Formato de vídeo no soportado. Usa MP4 o MOV';
      }
      if ((totalVideoSize + file.size) / (1024 * 1024) > MAX_VIDEO_SIZE_MB) {
        return `Tamaño total de vídeos excede ${MAX_VIDEO_SIZE_MB}MB`;
      }
    }

    if (!isImage && !isVideo) {
      return 'Solo se permiten imágenes y vídeos';
    }

    return null;
  }, [photosCount, videosCount, totalVideoSize]);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      setError(null);

      for (const file of Array.from(files)) {
        const validationError = validateFile(file);
        if (validationError) {
          setError(validationError);
          continue;
        }

        try {
          await onUpload(file);
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : 'Error desconocido';
          console.warn('File upload failed:', errorMessage);
          setError('Error al subir el archivo. Por favor, inténtalo de nuevo.');
        }
      }
    },
    [onUpload, validateFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'rounded-lg border-2 border-dashed p-6 text-center transition-colors',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50'
        )}
      >
        <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">
          Arrastra archivos aquí o{' '}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-primary underline-offset-2 hover:underline"
          >
            selecciona
          </button>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Fotos (JPG, PNG) o vídeos (MP4, MOV)
        </p>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/mp4,video/quicktime"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          className="hidden"
        />
      </div>

      {/* Limits */}
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Image className="h-3.5 w-3.5" />
          <span>
            Fotos: {photosCount}/{MAX_PHOTOS}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Video className="h-3.5 w-3.5" />
          <span>
            Vídeos: {videosCount}/{MAX_VIDEOS}
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Evidence list */}
      {evidencias.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Archivos subidos</h4>
          <div className="space-y-2">
            {evidencias.map((evidence) => (
              <EvidenceItem
                key={evidence.id}
                evidence={evidence}
                onDelete={() => onDelete(evidence.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Note */}
      <p className="text-xs text-muted-foreground">
        Los enlaces de acceso son temporales (seguridad)
      </p>
    </div>
  );
}

function EvidenceItem({
  evidence,
  onDelete,
}: {
  evidence: Evidence;
  onDelete: () => void;
}) {
  const Icon = evidence.type === 'photo' ? Image : evidence.type === 'video' ? Video : File;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-2">
      {/* Thumbnail */}
      <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded bg-muted">
        {evidence.url && evidence.type === 'photo' ? (
          <img
            src={evidence.url}
            alt={evidence.name}
            className="h-full w-full object-cover"
          />
        ) : evidence.url && evidence.type === 'video' ? (
          <video
            src={evidence.url}
            className="h-full w-full object-cover"
            muted
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{evidence.name}</p>
        <p className="text-xs text-muted-foreground">
          {(evidence.size / (1024 * 1024)).toFixed(1)} MB
        </p>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2">
        {evidence.status === 'uploading' && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {evidence.status === 'completed' && (
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        )}
        {evidence.status === 'error' && (
          <AlertCircle className="h-4 w-4 text-destructive" />
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
