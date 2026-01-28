
import React from 'react';
import { FileNode } from '../types';

interface EditorProps {
  file: FileNode;
  onContentChange: (newContent: string) => void;
}

export const Editor: React.FC<EditorProps> = ({ file, onContentChange }) => {
  const isBinary = !file.content && file.data;

  if (isBinary) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 p-10">
        <div className="bg-white p-4 rounded-lg shadow-sm border text-center">
          <p className="text-sm font-medium text-gray-600 mb-4">Preview not available for binary files</p>
          <div className="p-4 bg-gray-50 rounded border border-dashed text-xs text-gray-400 code-font">
            {file.name} ({Math.round((file.data?.length || 0) / 1024)} KB)
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="h-12 px-4 border-b flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-3">
           <span className="text-xs font-mono text-gray-400 bg-gray-50 px-2 py-1 rounded border">{file.path}</span>
        </div>
        <div className="flex items-center">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mr-2">Editor Mode</span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative flex flex-col">
        <textarea
          value={file.content || ''}
          onChange={(e) => onContentChange(e.target.value)}
          className="flex-1 p-6 code-font text-sm leading-relaxed resize-none focus:outline-none bg-white text-gray-800 selection:bg-blue-100"
          spellCheck={false}
          placeholder="Enter LaTeX content here..."
        />
      </div>
    </div>
  );
};
