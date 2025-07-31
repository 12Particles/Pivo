import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ImagePlus, X, Send, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { toast } from "@/hooks/use-toast";
import { CodingAgentExecutionStatus } from "@/types";

interface MessageInputProps {
  input: string;
  images: string[];
  isSending: boolean;
  pendingMessages: string[];
  executionStatus?: CodingAgentExecutionStatus;
  onInputChange: (value: string) => void;
  onImagesChange: (images: string[]) => void;
  onSend: () => void;
  onKeyPress: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export function MessageInput({
  input,
  images,
  isSending,
  pendingMessages,
  executionStatus,
  onInputChange,
  onImagesChange,
  onSend,
  onKeyPress
}: MessageInputProps) {
  const { t } = useTranslation();

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter(item => item.type.startsWith("image/"));
    
    if (imageItems.length === 0) return;
    
    e.preventDefault();
    const newImages: string[] = [];

    for (const item of imageItems) {
      const file = item.getAsFile();
      if (file) {
        try {
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          newImages.push(base64);
        } catch (error) {
          console.error("Failed to read pasted image:", error);
        }
      }
    }

    if (newImages.length > 0) {
      onImagesChange([...images, ...newImages].slice(0, 5)); // Limit to 5 images
      toast({
        title: t('ai.imagePasted'),
        description: t('ai.imagePastedDesc', { count: newImages.length }),
      });
    }
  };

  const handleImageSelect = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [{
          name: "Images",
          extensions: ["png", "jpg", "jpeg", "gif", "webp"],
        }],
      });

      if (selected) {
        const files = Array.isArray(selected) ? selected : [selected];
        const imagePromises = files.map(async (file) => {
          const data = await readFile(file);
          // Convert to base64 for display
          const base64 = btoa(String.fromCharCode(...new Uint8Array(data)));
          return `data:image/png;base64,${base64}`;
        });
        
        const imageUrls = await Promise.all(imagePromises);
        onImagesChange([...images, ...imageUrls]);
      }
    } catch (error) {
      console.error("Failed to select images:", error);
      toast({
        title: t('common.error'),
        description: t('ai.selectImageError'),
        variant: "destructive",
      });
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...images];
    URL.revokeObjectURL(newImages[index]);
    newImages.splice(index, 1);
    onImagesChange(newImages);
  };

  const isDisabled = isSending || executionStatus === CodingAgentExecutionStatus.Running;

  return (
    <div className="border-t bg-background p-4 space-y-3">
      {images.length > 0 && (
        <div className="flex gap-2 flex-wrap p-3 bg-muted/50 rounded-lg">
          {images.map((img, index) => (
            <div key={index} className="relative group">
              <img
                src={img}
                alt={`Attachment ${index + 1}`}
                className="h-20 w-20 object-cover rounded-md border shadow-sm"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                onClick={() => removeImage(index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
      
      <div className="flex gap-2 items-start">
        <Button
          variant="outline"
          size="icon"
          onClick={handleImageSelect}
          title={t('ai.addImage')}
          className="flex-shrink-0"
        >
          <ImagePlus className="h-4 w-4" />
        </Button>
        
        <Textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyPress={onKeyPress}
          onPaste={handlePaste}
          placeholder={t('ai.sendMessage')}
          className="flex-1 min-h-[36px] max-h-[120px] resize-none py-2"
          disabled={isDisabled}
        />
        
        <Button 
          onClick={onSend} 
          disabled={(!input.trim() && images.length === 0) || isDisabled}
          className="flex-shrink-0"
        >
          {pendingMessages.length > 0 ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              {t('ai.pendingMessages', { count: pendingMessages.length })}
            </>
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}