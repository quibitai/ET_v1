'use client';

import React from 'react';
import {
  X,
  FileText,
  Image,
  FileSpreadsheet,
  FileCode,
  File,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilePillProps {
  filename: string;
  contentType: string;
  url?: string;
  size?: 'sm' | 'md';
  showRemove?: boolean;
  onRemove?: () => void;
  className?: string;
}

const getFileIcon = (contentType: string, filename: string) => {
  const extension = filename.split('.').pop()?.toLowerCase();

  if (contentType.startsWith('image/')) {
    return <Image className="w-3 h-3" />;
  }

  if (
    contentType.includes('spreadsheet') ||
    ['xlsx', 'xls', 'csv'].includes(extension || '')
  ) {
    return <FileSpreadsheet className="w-3 h-3" />;
  }

  if (
    ['js', 'ts', 'py', 'java', 'c', 'cpp', 'html', 'css', 'json'].includes(
      extension || '',
    )
  ) {
    return <FileCode className="w-3 h-3" />;
  }

  if (['txt', 'md', 'pdf', 'doc', 'docx'].includes(extension || '')) {
    return <FileText className="w-3 h-3" />;
  }

  return <File className="w-3 h-3" />;
};

const getFileTypeColor = (contentType: string, filename: string) => {
  const extension = filename.split('.').pop()?.toLowerCase();

  if (contentType.startsWith('image/')) {
    return 'bg-green-100 text-green-700 border-green-200';
  }

  if (
    contentType.includes('spreadsheet') ||
    ['xlsx', 'xls', 'csv'].includes(extension || '')
  ) {
    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  }

  if (
    ['js', 'ts', 'py', 'java', 'c', 'cpp', 'html', 'css', 'json'].includes(
      extension || '',
    )
  ) {
    return 'bg-blue-100 text-blue-700 border-blue-200';
  }

  if (['txt', 'md', 'pdf', 'doc', 'docx'].includes(extension || '')) {
    return 'bg-purple-100 text-purple-700 border-purple-200';
  }

  return 'bg-gray-100 text-gray-700 border-gray-200';
};

export function FilePill({
  filename,
  contentType,
  url,
  size = 'md',
  showRemove = false,
  onRemove,
  className,
}: FilePillProps) {
  const icon = getFileIcon(contentType, filename);
  const colorClasses = getFileTypeColor(contentType, filename);

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
  };

  const truncatedFilename =
    filename.length > 20 ? `${filename.substring(0, 17)}...` : filename;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border transition-colors',
        colorClasses,
        sizeClasses[size],
        className,
      )}
    >
      {icon}
      <span className="font-medium truncate max-w-[120px]">
        {truncatedFilename}
      </span>
      {showRemove && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 hover:bg-black/10 rounded-full p-0.5 transition-colors"
          aria-label="Remove file"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
