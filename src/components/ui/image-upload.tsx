import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ImagePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";

interface ImageUploadProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
  maxSizeBytes?: number;
  className?: string;
  disabled?: boolean;
  onFileSelectStart?: () => void;
  onFileSelectEnd?: () => void;
}

export function ImageUpload({
  images,
  onImagesChange,
  maxImages = 5,
  maxSizeBytes = 10 * 1024 * 1024, // 10MB
  className,
  disabled = false,
  onFileSelectStart,
  onFileSelectEnd,
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = async (files: File[]) => {
    const newImages: string[] = [];
    
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid file type",
          description: `${file.name} is not an image file`,
          variant: "destructive",
        });
        continue;
      }

      if (file.size > maxSizeBytes) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds the ${maxSizeBytes / 1024 / 1024}MB limit`,
          variant: "destructive",
        });
        continue;
      }

      try {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        newImages.push(base64);
      } catch (error) {
        console.error("Failed to read file:", error);
        toast({
          title: "Failed to read file",
          description: file.name,
          variant: "destructive",
        });
      }
    }

    const totalImages = [...images, ...newImages];
    if (totalImages.length > maxImages) {
      toast({
        title: "Too many images",
        description: `Maximum ${maxImages} images allowed`,
        variant: "destructive",
      });
      onImagesChange(totalImages.slice(0, maxImages));
    } else {
      onImagesChange(totalImages);
    }
  };

  const handleFileSelect = async () => {
    try {
      // Notify parent that file selection is starting
      onFileSelectStart?.();
      
      const selected = await open({
        multiple: true,
        filters: [{
          name: "Images",
          extensions: ["png", "jpg", "jpeg", "gif", "webp"],
        }],
      });

      if (selected) {
        const files = Array.isArray(selected) ? selected : [selected];
        const fileObjects: File[] = [];
        
        for (const filePath of files) {
          try {
            const data = await readFile(filePath);
            const fileName = filePath.split('/').pop() || 'image';
            const blob = new Blob([data]);
            const file = new File([blob], fileName, { type: 'image/png' });
            fileObjects.push(file);
          } catch (error) {
            console.error("Failed to read file:", error);
          }
        }
        
        await processFiles(fileObjects);
      }
    } catch (error) {
      console.error("Failed to select images:", error);
      toast({
        title: "Failed to select images",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      // Always notify parent that file selection is done
      onFileSelectEnd?.();
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    await processFiles(files);
  }, [disabled, images, maxImages, onImagesChange]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    if (disabled) return;

    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter(item => item.type.startsWith("image/"));
    
    if (imageItems.length === 0) return;

    e.preventDefault();
    const files: File[] = [];

    for (const item of imageItems) {
      const file = item.getAsFile();
      if (file) {
        files.push(file);
      }
    }

    await processFiles(files);
  }, [disabled, images, maxImages, onImagesChange]);

  const removeImage = (index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    onImagesChange(newImages);
  };

  return (
    <div
      className={cn("space-y-2", className)}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onPaste={handlePaste}
    >
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((img, index) => (
            <div key={index} className="relative group">
              <img
                src={img}
                alt={`Upload ${index + 1}`}
                className="h-20 w-20 object-cover rounded-md border shadow-sm"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                onClick={() => removeImage(index)}
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-4 text-center transition-colors",
          isDragging ? "border-primary bg-primary/10" : "border-muted-foreground/25",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={async (e) => {
            const files = Array.from(e.target.files || []);
            await processFiles(files);
            if (fileInputRef.current) {
              fileInputRef.current.value = "";
            }
          }}
          disabled={disabled}
        />

        <Button
          variant="outline"
          size="sm"
          onClick={handleFileSelect}
          disabled={disabled || images.length >= maxImages}
        >
          <ImagePlus className="h-4 w-4 mr-2" />
          Add Images
        </Button>

        <p className="text-xs text-muted-foreground mt-2">
          {images.length}/{maxImages} images • Drop, paste or click to upload
        </p>
      </div>
    </div>
  );
}