'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, File as FileIcon, Loader2 } from 'lucide-react';

interface FilePreviewProps {
  files: Array<File>;
  progress: Record<string, number>;
}

export function FilePreview({ files, progress }: FilePreviewProps) {
  return (
    <div className="w-full space-y-2">
      {files.map((file) => (
        <motion.div
          key={file.name}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="flex items-center justify-between p-2 border rounded-lg bg-muted/50"
        >
          <div className="flex items-center gap-2">
            <FileIcon className="w-6 h-6 text-muted-foreground" />
            <div className="text-sm">
              <p className="font-medium truncate max-w-xs">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(2)} KB
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {progress[file.name] === 100 ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
