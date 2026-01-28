
import React, { useState } from 'react';
import { FileNode, AIResponse } from '../types';
import { refineResume } from '../services/geminiService';
import { Send, Check, RefreshCw, AlertCircle, Info } from 'lucide-react';

interface AIPanelProps {
  projectFiles: FileNode[];
  onApplySuggestion: (path: string, content: string) => void;
}

export const AIPanel: React.FC<AIPanelProps> = ({ projectFiles, onApplySuggestion }) => {
  const [jobDescription, setJobDescription] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<AIResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRefine = async () => {
    if (!jobDescription.trim()) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const response = await refineResume(projectFiles, jobDescription);
      setResults(response);
    } catch (err: any) {
      console.error(err);
      setError("Failed to refine. Check console for details.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 border-l border-gray-200 shadow-inner">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-2 tracking-wide">Target Job Description</label>
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            className="w-full h-40 p-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white resize-none shadow-sm transition-all"
            placeholder="Paste the job description here..."
          />
        </div>

        <button
          onClick={handleRefine}
          disabled={isAnalyzing || !jobDescription.trim() || projectFiles.length === 0}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-purple-600 text-white rounded-lg font-semibold shadow-md hover:bg-purple-700 active:transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isAnalyzing ? (
            <RefreshCw size={18} className="animate-spin" />
          ) : (
            <Send size={18} />
          )}
          {isAnalyzing ? 'Refining...' : 'Refine Resume'}
        </button>

        {error && (
          <div className="p-3 bg-red-50 text-red-700 rounded-lg flex gap-2 text-sm border border-red-100 animate-in fade-in slide-in-from-top-2">
            <AlertCircle size={16} className="shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {results && (
          <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Info size={16} className="text-blue-600" />
                <span className="font-bold text-blue-800 text-sm">Strategy</span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{results.generalAdvice}</p>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">Suggested File Changes</label>
              {results.suggestions.map((suggestion, idx) => (
                <div key={idx} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm group hover:border-purple-200 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-bold text-gray-700 truncate max-w-[200px]">{suggestion.filePath}</span>
                    <button
                      onClick={() => onApplySuggestion(suggestion.filePath, suggestion.refinedContent)}
                      className="flex items-center gap-1 text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded-md font-medium hover:bg-green-100 transition-colors shadow-sm border border-green-100"
                    >
                      <Check size={12} /> Apply Changes
                    </button>
                  </div>
                  <div className="p-2 bg-purple-50/50 rounded text-[11px] text-purple-800 mb-3 border border-purple-100/50">
                    <span className="font-bold">Reason:</span> {suggestion.explanation}
                  </div>
                  <div className="max-h-48 overflow-auto relative rounded border border-gray-200 bg-gray-50">
                    <pre className="p-3 text-[10px] code-font text-gray-600 whitespace-pre-wrap leading-relaxed">
                      {suggestion.refinedContent}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
