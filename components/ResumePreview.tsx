

import React, { useMemo, useState, useRef } from 'react';
import { FileNode } from '../types';
import html2pdf from 'html2pdf.js';
import { Download } from 'lucide-react';

interface ResumePreviewProps {
  mainFile: FileNode;
  allFiles: FileNode[];
}

export const ResumePreview: React.FC<ResumePreviewProps> = ({ mainFile, allFiles }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const resumeRef = useRef<HTMLDivElement>(null);

  // Helper to find a file in the project tree by name or path
  const findFile = (nodes: FileNode[], fileName: string): FileNode | null => {
    const cleanFileName = fileName.trim().replace(/^.*[\\/]/, ''); // Just the name
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

    // 2. Extract Body - be more aggressive about finding actual content
    const docMatch = latex.match(/\\begin\{document\}([\s\S]*)\\end\{document\}/);
    let body = docMatch ? docMatch[1] : latex;

    // 2.5. Strip out common preamble artifacts that slip through
    // Remove makeatletter/makeatother blocks
    body = body.replace(/\\makeatletter[\s\S]*?\\makeatother/g, '');
    // Remove newcommand, renewcommand, providecommand definitions
    body = body.replace(/\\(new|renew|provide)command\*?\{[^}]+\}(\[[^\]]*\])?\{[^}]*\}/g, '');
    // Remove def commands
    body = body.replace(/\\def\\[a-zA-Z@]+[^{]*\{[^}]*\}/g, '');
    // Remove setlength, addtolength commands
    body = body.replace(/\\(set|addto)length\{[^}]+\}\{[^}]+\}/g, '');
    // Remove vspace, hspace with negative values
    body = body.replace(/\\[vh]space\*?\{-?[^}]+\}/g, '');

    // 2.6. Remove structural formatting tokens
    // Remove color definitions like BlackRGBo, o, o
    body = body.replace(/Black(RGB|CMYK)[a-z]?,\s*[a-z0-9]+,\s*[a-z0-9]+(\s*\}\s*Xr\s*@)?/gi, '');
    // Remove tabular column specifications like l@{}, c@{}, r@{}, 0.97l@r
    body = body.replace(/[0-9.]*[lcr]@\{[^}]*\}/g, '');
    body = body.replace(/[0-9.]+[lcr]@[lcr]/g, '');
    // Remove list parameters like leftmargin=0.15in, label=
    body = body.replace(/leftmargin\s*=\s*[0-9.]+[a-z]+/gi, '');
    body = body.replace(/label\s*=\s*[^,}]*/gi, '');
    // Remove \$ symbols (dollar signs used in LaTeX math mode)
    body = body.replace(/\\\$/g, '');
    // Remove orphaned multiple closing braces
    body = body.replace(/\}\}\}+/g, '');
    // Remove negative numbers like -0.2 that are layout values
    body = body.replace(/^-?\d+\.?\d*\s*$/gm, '');

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

    // 8. Strip common LaTeX commands that might remain
    body = body.replace(/\\(par|noindent|ignorespaces|unskip)\b/g, '');
    body = body.replace(/\\@\w+/g, ''); // Remove @ commands like \@startsection

    // 8.5. Strip remaining resume-specific and common LaTeX commands
    // Remove resume environment commands
    body = body.replace(/\\(resumeItem|resumeSubItem|resumeSubSubheading|resumeSubHeadingListStart|resumeSubHeadingListEnd)\b/g, '');
    // Remove list environment commands
    body = body.replace(/\\(itemize|enumerate|description|trivlist)\b/g, '');
    // Remove spacing commands
    body = body.replace(/\\(smallskip|medskip|bigskip|vfill|hfill|linebreak|newline|pagebreak)\b/g, '');
    // Remove text size commands
    body = body.replace(/\\(tiny|scriptsize|footnotesize|small|normalsize|large|LARGE)\b/g, '');
    // Remove alignment/positioning
    body = body.replace(/\\(centering|raggedright|raggedleft|center|flushleft|flushright)\b/g, '');
    // Remove font family commands
    body = body.replace(/\\(rm|sf|tt|bf|it|sl|sc|textrm|textsf|texttt)\b/g, '');
    // Remove underline, emph, and other text decorations we haven't converted
    body = body.replace(/\\(underline|emph|textsc|textnormal|textup|textsl)\{([^}]+)\}/g, '$2');
    // Remove tabular and table commands
    body = body.replace(/\\(hline|cline|multicolumn|multirow)\b/g, '');
    // Remove any remaining backslash commands with arguments
    body = body.replace(/\\[a-zA-Z]+\*?\{[^}]*\}/g, '');

    // Nuke ALL remaining backslash commands (catch-all)
    body = body.replace(/\\[a-zA-Z@]+\*?/g, '');
    // Remove remaining standalone backslashes
    body = body.replace(/\\/g, '');

    // Deep clean nested empty braces/brackets
    for (let i = 0; i < 8; i++) {
      body = body.replace(/\{([^{}\\]*)\}/g, '$1');
      body = body.replace(/\[([^\]\\]*)\]/g, '$1');
    }

    // Remove leading/trailing whitespace and empty lines at start
    body = body.replace(/^[\s\n]+/, '').replace(/[\s\n]+$/, '');
    // Clean up multiple consecutive line breaks
    body = body.replace(/(<br\/?>[\s]*){3,}/g, '<br/><br/>');

    return body;
  }, [fullContent, allFiles]);

  const handleDownloadPDF = async () => {
    if (!resumeRef.current || isDownloading) return;

    setIsDownloading(true);
    try {
      const element = resumeRef.current;
      const opt = {
        margin: [10, 10, 10, 10] as [number, number, number, number],
        filename: 'resume.pdf',
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      await html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="relative">
      {/* Download Button */}
      <div className="sticky top-0 z-10 bg-white border-b shadow-sm mb-4 p-3 flex justify-end">
        <button
          onClick={handleDownloadPDF}
          disabled={isDownloading || !renderedResume.trim()}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          <Download size={16} />
          {isDownloading ? 'Generating PDF...' : 'Download as PDF'}
        </button>
      </div>

      {/* Resume Preview */}
      <div
        ref={resumeRef}
        className="bg-white shadow-2xl w-[210mm] min-h-[297mm] p-[12mm] text-gray-900 font-serif leading-tight overflow-hidden print:shadow-none transition-all duration-300"
      >
        <style dangerouslySetInnerHTML={{
          __html: `
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
            <p className="text-sm">Click &apos;Visual Preview&apos; on your main .tex file</p>
          </div>
        )}
      </div>
    </div>
  );
};
