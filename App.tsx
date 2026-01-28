
import React, { useState, useCallback, useRef } from 'react';
import { FileTree } from './components/FileTree';
import { Editor } from './components/Editor';
import { AIPanel } from './components/AIPanel';
import { ResumePreview } from './components/ResumePreview';
import { FileNode, ProjectState } from './types';
import { extractZip, createZip } from './utils/zipUtils';
import { Upload, Download, FileText, Bot, PanelLeftClose, PanelRightClose, Eye, EyeOff } from 'lucide-react';

const App: React.FC = () => {
  const [project, setProject] = useState<ProjectState>({
    files: [],
    activeFilePath: null,
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [previewWidth, setPreviewWidth] = useState(600);
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);
  const [isDraggingPreview, setIsDraggingPreview] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const extractedFiles = await extractZip(file);
      setProject({
        files: extractedFiles,
        activeFilePath: extractedFiles.length > 0 ? findFirstTexFile(extractedFiles) : null,
      });
    } catch (error) {
      console.error("Error processing zip:", error);
      alert("Failed to process the ZIP file. Please ensure it's a valid LaTeX project.");
    } finally {
      setIsProcessing(false);
    }
  };

  const findFirstTexFile = (nodes: FileNode[]): string | null => {
    for (const node of nodes) {
      if (node.type === 'file' && node.name.endsWith('.tex')) return node.path;
      if (node.children) {
        const found = findFirstTexFile(node.children);
        if (found) return found;
      }
    }
    return null;
  };

  const updateFileContent = useCallback((path: string, newContent: string) => {
    setProject(prev => {
      const updateNodes = (nodes: FileNode[]): FileNode[] => {
        return nodes.map(node => {
          if (node.path === path) return { ...node, content: newContent };
          if (node.children) return { ...node, children: updateNodes(node.children) };
          return node;
        });
      };
      return { ...prev, files: updateNodes(prev.files) };
    });
  }, []);

  const getActiveFile = (nodes: FileNode[], path: string | null): FileNode | null => {
    if (!path) return null;
    const find = (nodes: FileNode[]): FileNode | null => {
      for (const node of nodes) {
        if (node.path === path) return node;
        if (node.children) {
          const res = find(node.children);
          if (res) return res;
        }
      }
      return null;
    };
    return find(nodes);
  };

  const activeFile = getActiveFile(project.files, project.activeFilePath);

  const handleDownload = async () => {
    if (project.files.length === 0) return;
    const blob = await createZip(project.files);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "refined_resume.zip";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Draggable divider handlers
  const handleSidebarDragStart = () => setIsDraggingSidebar(true);
  const handlePreviewDragStart = () => setIsDraggingPreview(true);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDraggingSidebar) {
      const newWidth = Math.max(200, Math.min(500, e.clientX));
      setSidebarWidth(newWidth);
    }
    if (isDraggingPreview) {
      const newWidth = Math.max(400, Math.min(800, window.innerWidth - e.clientX));
      setPreviewWidth(newWidth);
    }
  }, [isDraggingSidebar, isDraggingPreview]);

  const handleMouseUp = useCallback(() => {
    setIsDraggingSidebar(false);
    setIsDraggingPreview(false);
  }, []);

  React.useEffect(() => {
    if (isDraggingSidebar || isDraggingPreview) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDraggingSidebar, isDraggingPreview, handleMouseMove, handleMouseUp]);

  return (
    <div className="flex h-screen w-full bg-white overflow-hidden flex-col">
      {/* Header */}
      <header className="h-14 border-b bg-white flex items-center justify-between px-4 shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-1.5 rounded-lg text-white">
            <FileText size={20} />
          </div>
          <div className="flex flex-col -space-y-1">
            <h1 className="font-bold text-base tracking-tight">LaTeX Resume AI</h1>
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">Workspace</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            <Upload size={16} />
            Upload ZIP
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".zip"
            className="hidden"
          />
          <button
            onClick={handleDownload}
            disabled={project.files.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <Download size={16} />
            Download Refined
          </button>
          <button
            onClick={() => setIsPreviewOpen(!isPreviewOpen)}
            disabled={!activeFile || !activeFile.name.endsWith('.tex')}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${isPreviewOpen
                ? 'bg-green-600 text-white shadow-inner'
                : 'bg-green-50 text-green-700 hover:bg-green-100'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isPreviewOpen ? <EyeOff size={16} /> : <Eye size={16} />}
            Preview
          </button>
          <div className="h-6 w-px bg-gray-200 mx-1"></div>
          <button
            onClick={() => setIsAIPanelOpen(!isAIPanelOpen)}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${isAIPanelOpen
                ? 'bg-purple-600 text-white shadow-inner'
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
              }`}
          >
            <Bot size={16} />
            AI Refiner
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        <div
          className="border-r bg-gray-50 flex flex-col transition-all duration-200"
          style={{ width: isSidebarOpen ? `${sidebarWidth}px` : '0px', overflow: isSidebarOpen ? 'visible' : 'hidden' }}
        >
          <div className="p-3 border-b flex items-center justify-between bg-white">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Project Files</span>
            <button onClick={() => setIsSidebarOpen(false)} className="text-gray-400 hover:text-gray-600">
              <PanelLeftClose size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {project.files.length > 0 ? (
              <FileTree
                nodes={project.files}
                activePath={project.activeFilePath}
                onSelect={(path) => setProject(p => ({ ...p, activeFilePath: path }))}
              />
            ) : (
              <div className="p-8 text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Upload size={20} className="text-gray-400" />
                </div>
                <p className="text-gray-400 text-xs">No project loaded.</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Drag Handle */}
        {isSidebarOpen && (
          <div
            onMouseDown={handleSidebarDragStart}
            className="w-1 bg-gray-200 hover:bg-blue-500 cursor-col-resize transition-colors group relative"
          >
            <div className="absolute inset-y-0 -left-1 -right-1" />
          </div>
        )}

        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="absolute left-0 top-4 z-20 bg-white border border-l-0 rounded-r-md p-1 shadow-sm text-gray-400 hover:text-gray-600"
          >
            <PanelLeftClose size={16} className="rotate-180" />
          </button>
        )}

        {/* Editor Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-white">
          {activeFile ? (
            <Editor
              file={activeFile}
              onContentChange={(val) => updateFileContent(activeFile.path, val)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50">
              <div className="w-16 h-16 bg-white border rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                <FileText size={32} className="text-gray-200" />
              </div>
              <p className="text-sm font-medium">Select a file to begin editing</p>
            </div>
          )}
        </div>

        {/* Preview Drag Handle */}
        {isPreviewOpen && activeFile?.name.endsWith('.tex') && (
          <div
            onMouseDown={handlePreviewDragStart}
            className="w-1 bg-gray-200 hover:bg-blue-500 cursor-col-resize transition-colors group relative"
          >
            <div className="absolute inset-y-0 -left-1 -right-1" />
          </div>
        )}

        {/* Preview Panel */}
        <div
          className="border-l flex flex-col bg-gray-100 transition-all duration-200"
          style={{ width: isPreviewOpen && activeFile?.name.endsWith('.tex') ? `${previewWidth}px` : '0px', overflow: isPreviewOpen && activeFile?.name.endsWith('.tex') ? 'visible' : 'hidden' }}
        >
          <div className="p-3 border-b flex items-center justify-between bg-white shrink-0">
            <div className="flex items-center gap-2">
              <Eye size={18} className="text-green-600" />
              <span className="font-semibold text-gray-700">Live Preview</span>
            </div>
            <button onClick={() => setIsPreviewOpen(false)} className="text-gray-400 hover:text-gray-600">
              <PanelRightClose size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            {activeFile && activeFile.name.endsWith('.tex') && (
              <ResumePreview mainFile={activeFile} allFiles={project.files} />
            )}
          </div>
        </div>

        {/* AI Panel */}
        <div className={`transition-all duration-300 ease-in-out border-l flex flex-col shadow-2xl z-10 ${isAIPanelOpen ? 'w-96' : 'w-0 overflow-hidden border-none'}`}>
          <div className="p-3 border-b flex items-center justify-between bg-white shrink-0">
            <div className="flex items-center gap-2">
              <Bot size={18} className="text-purple-600" />
              <span className="font-semibold text-gray-700">AI Assistant</span>
            </div>
            <button onClick={() => setIsAIPanelOpen(false)} className="text-gray-400 hover:text-gray-600">
              <PanelRightClose size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <AIPanel
              projectFiles={project.files}
              onApplySuggestion={(path, content) => updateFileContent(path, content)}
            />
          </div>
        </div>
      </main>

      {isProcessing && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4 max-w-sm text-center">
            <div className="relative">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-100 border-t-blue-600"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <FileText size={16} className="text-blue-600" />
              </div>
            </div>
            <div>
              <p className="font-bold text-lg text-gray-900">Uploading Project</p>
              <p className="text-sm text-gray-500">Unpacking ZIP and preparing workspace...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
