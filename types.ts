
export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  content?: string; // For text files
  data?: Uint8Array; // For binary files like images
  mimeType?: string;
  children?: FileNode[];
}

export interface ProjectState {
  files: FileNode[];
  activeFilePath: string | null;
}

export interface AISuggestion {
  filePath: string;
  originalContent: string;
  refinedContent: string;
  explanation: string;
}

export interface AIResponse {
  suggestions: AISuggestion[];
  generalAdvice: string;
}
