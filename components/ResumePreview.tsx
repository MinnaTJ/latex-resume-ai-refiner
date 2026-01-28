
import React, { useMemo } from 'react';
import { FileNode } from '../types';

interface ResumePreviewProps {
  mainFile: FileNode;
  allFiles: FileNode[];
}

export const ResumePreview: React.FC<ResumePreviewProps> = ({ mainFile, allFiles }) => {
  
  // Helper to find a file in the project tree by name or path
  const findFile = (nodes: FileNode[], fileName: string): FileNode | null => {
    const cleanFileName = fileName.trim().replace(/^.*[\\\/]/, ''); // Just the name
    const search = (list: FileNode[]): FileNode | null => {
      for (const node of list) {
        if (node.name === cleanFileName || node.path.endsWith('/' + cleanFileName) || node.path === fileName) return node;
        if (node.children) {
          const res = search(node.children);
          if (res) return res;
        }
      }
      return null;
    };
    return search(nodes);
  };

  // Recursively stitch together LaTeX files
  const fullContent = useMemo(() => {
    const resolveIncludes = (content: string, visited = new Set<string>()): string => {
      const contentId = content.substring(0, 100);
      if (visited.has(contentId)) return '';
      visited.add(contentId);

      return content.replace(/\\(input|include)\{(.+?)\}/g, (_, cmd, path) => {
        const p = path.trim();
        const variants = [p, p + '.tex', p + '.cls', p + '.sty'];
        for (const v of variants) {
          const file = findFile(allFiles, v);
          if (file && file.content) return resolveIncludes(file.content, visited);
        }
        return ``; 
      });
    };
    return resolveIncludes(mainFile.content || '');
  }, [mainFile, allFiles]);

  const renderedResume = useMemo(() => {
    let latex = fullContent.replace(/%.*$/gm, ''); // Strip comments
    
    // 1. Image Resolution (Base64)
    latex = latex.replace(/\\includegraphics\[.*?\]\{(.+?)\}/g, (_, imgPath) => {
      const file = findFile(allFiles, imgPath);
      if (file && file.data) {
        const base64 = btoa(
          new Uint8Array(file.data).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        const mime = file.name.endsWith('.png') ? 'image/png' : 'image/jpeg';
        return `<img src="data:${mime};base64,${base64}" class="h-24 w-auto object-contain mx-auto" />`;
      }
      return '';
    });

    // 2. Extract Body
    const docMatch = latex.match(/\\begin\{document\}([\s\S]*)\\end\{document\}/);
    let body = docMatch ? docMatch[1] : latex;

    // 3. Extreme Layout Stripping
    // This cleans up the "junk" like [1]{{{ -2pt }}} and *(0.97){l@{}r}
    // Remove environment arguments: [opt]{arg1}{arg2}...
    body = body.replace(/\\begin\{[a-zA-Z*]+\}(\[[^\]]*\])?(\{([^}]*)\})?(\{([^}]*)\})?(\{([^}]*)\})?/g, '');
    body = body.replace(/\\end\{[a-zA-Z*]+\}/g, '');
    
    // Remove dangling tabular-style formatting strings
    body = body.replace(/\[[^\]]{1,20}\]/g, ''); // Small optional brackets
    body = body.replace(/\{[lcr|@{}*()0-9.\\ ]{1,30}\}/g, ''); // Structural braces

    // 4. Handle Specific Professional Macros
    body = body.replace(/\\resumeSubheading\s*\{(.+?)\}\s*\{(.+?)\}\s*\{(.+?)\}\s*\{(.+?)\}/g, 
      '<div class="flex justify-between mt-4 font-bold text-gray-900 leading-none"><span>$1</span><span class="text-xs font-semibold">$2</span></div>' +
      '<div class="flex justify-between italic text-xs text-gray-600 mb-1"><span>$3</span><span>$4</span></div>');

    body = body.replace(/\\resumeProjectHeading\s*\{(.+?)\}\s*\{(.+?)\}/g, 
      '<div class="flex justify-between mt-4 font-bold text-gray-900 leading-none"><span>$1</span><span class="text-xs font-normal text-gray-500">$2</span></div>');

    body = body.replace(/\\section\{(.+?)\}/g, '<h2 class="text-sm font-bold border-b-2 border-gray-800 mt-6 mb-2 uppercase tracking-widest text-gray-900">$1</h2>');

    // 5. Formatting
    body = body.replace(/\\scshape\s+([^{}\\]+)/g, '<span class="small-caps">$1</span>');
    body = body.replace(/\{\\scshape\s+([^}]+)\}/g, '<span class="small-caps">$1</span>');
    body = body.replace(/\\textbf\{([\s\S]+?)\}/g, '<strong>$1</strong>');
    body = body.replace(/\\textit\{([\s\S]+?)\}/g, '<em>$1</em>');
    body = body.replace(/\\Huge\s+([^{}\\]+)/g, '<h1 class="text-3xl font-extrabold mb-1">$1</h1>');
    body = body.replace(/\\huge\s+([^{}\\]+)/g, '<h1 class="text-2xl font-bold mb-1">$1</h1>');
    body = body.replace(/\\Large\s+([^{}\\]+)/g, '<h2 class="text-xl font-bold">$1</h2>');

    // 6. Lists
    body = body.replace(/\\resumeItemListStart/g, '<ul class="list-disc ml-4 space-y-0.5 mt-1 text-[13px] text-gray-800">');
    body = body.replace(/\\resumeItemListEnd/g, '</ul>');
    body = body.replace(/\\item/g, '</li><li class="pl-1">');
    body = body.replace(/<\/ul>\s*<\/li><li class="pl-1">/g, '</ul>'); // Fix double wrap
    body = body.replace(/<li class="pl-1">\s*<\/ul>/g, '</ul>'); // Cleanup empty trailing

    // 7. Final Polish
    body = body
      .replace(/\\seticon\{.+?\}\{(.+?)\}/g, '<span class="text-gray-400 inline-block mr-1">▶</span>$1')
      .replace(/\\href\{.+?\}\{(.+?)\}/g, '<span class="text-blue-700 underline">$1</span>')
      .replace(/\\url\{(.+?)\}/g, '<span class="text-blue-700 underline">$1</span>')
      .replace(/\\quad/g, '&nbsp;&nbsp;')
      .replace(/\\\\/g, '<br/>')
      .replace(/\\&/g, '&')
      .replace(/\\_/g, '_')
      .replace(/&/g, ' ') 
      .replace(/#\d/g, ''); 

    // Nuke remaining commands
    body = body.replace(/\\[a-zA-Z]+/g, '');
    
    // Deep clean nested empty braces/brackets
    for(let i=0; i<5; i++) {
        body = body.replace(/\{([^{}\\]*)\}/g, '$1');
        body = body.replace(/\[([^\]\\]*)\]/g, '$1');
    }

    return body;
  }, [fullContent, allFiles]);

  return (
    <div className="bg-white shadow-2xl w-[210mm] min-h-[297mm] p-[12mm] text-gray-900 font-serif leading-tight overflow-hidden print:shadow-none transition-all duration-300">
       <style dangerouslySetInnerHTML={{ __html: `
         .resume-body h1, .resume-body h2 { font-family: 'Inter', sans-serif; }
         .resume-body .small-caps { font-variant: small-caps; }
         .resume-body strong { font-weight: 700; color: #000; }
         .resume-body ul { margin-bottom: 0.75rem; }
         .resume-body li { margin-bottom: 2px; }
         .resume-body br + br { display: block; content: ""; margin-top: 5px; }
       `}} />
       
       <div 
         className="resume-body select-text selection:bg-blue-100 text-[13.5px]"
         dangerouslySetInnerHTML={{ __html: renderedResume }} 
       />

       {!renderedResume.trim() && (
         <div className="flex flex-col items-center justify-center h-[200mm] text-gray-300 italic border-2 border-dashed rounded-xl">
           <p className="text-xl font-bold mb-2">Visualizer Ready</p>
           <p className="text-sm">Click 'Visual Preview' on your main .tex file</p>
         </div>
       )}
    </div>
  );
};
