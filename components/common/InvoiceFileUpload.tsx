import { useCallback } from 'react';
import { FileUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InvoiceFileUploadProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
  index: number;
}

export function InvoiceFileUpload({
  files,
  onFilesChange,
  disabled,
  index,
}: InvoiceFileUploadProps) {
  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newFiles = event.target.files ? Array.from(event.target.files) : [];
      onFilesChange([...files, ...newFiles]);
    },
    [files, onFilesChange],
  );

  const removeFile = useCallback(
    (index: number) => {
      const newFiles = files.filter((_, i) => i !== index);
      onFilesChange(newFiles);
    },
    [files, onFilesChange],
  );

  return (
    <div className="space-y-0">
      <div className="flex flex-wrap gap-1">
        {files.map((file, index) => (
          <div
            key={index}
            className="flex items-center gap-2 bg-slate-100 border-slate-200 border-[1px] p-2 rounded-sm mb-1"
          >
            <span className="text-sm truncate max-w-[200px]">{file.name}</span>
            <button
              type="button"
              onClick={() => removeFile(index)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => document.getElementById(`file-upload-${index}`)?.click()}
          className="hover:bg-slate-200"
        >
          <FileUp className="h-4 w-4" />
          Attach Files
        </Button>
        <input
          id={`file-upload-${index}`}
          type="file"
          multiple
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled}
        />
      </div>
    </div>
  );
}
