
import React, { useState } from 'react';
import { FileNode } from '../types';
import { ChevronRight, ChevronDown, FileCode, ImageIcon, FileText } from 'lucide-react';

interface FileTreeProps {
  nodes: FileNode[];
  activePath: string | null;
  onSelect: (path: string) => void;
  depth?: number;
}

export const FileTree: React.FC<FileTreeProps> = ({ nodes, activePath, onSelect, depth = 0 }) => {
  return (
    <div className="select-none">
      {nodes.map((node) => (
        <FileTreeNode
          key={node.path}
          node={node}
          activePath={activePath}
          onSelect={onSelect}
          depth={depth}
        />
      ))}
    </div>
  );
};

const FileTreeNode: React.FC<{
  node: FileNode;
  activePath: string | null;
  onSelect: (path: string) => void;
  depth: number;
}> = ({ node, activePath, onSelect, depth }) => {
  const [isOpen, setIsOpen] = useState(true);
  const isActive = activePath === node.path;

  const getIcon = () => {
    if (node.type === 'folder') return isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />;
    if (node.name.endsWith('.tex')) return <FileCode size={14} className="text-blue-500" />;
    if (node.name.match(/\.(png|jpg|jpeg|svg)$/i)) return <ImageIcon size={14} className="text-green-500" />;
    return <FileText size={14} className="text-gray-400" />;
  };

  const handleClick = () => {
    if (node.type === 'folder') {
      setIsOpen(!isOpen);
    } else {
      onSelect(node.path);
    }
  };

  return (
    <div>
      <div
        onClick={handleClick}
        className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer text-sm transition-colors ${isActive ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600' : 'hover:bg-gray-100 text-gray-600'
          }`}
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
      >
        <span className="shrink-0">{getIcon()}</span>
        <span className="truncate">{node.name}</span>
      </div>
      {node.type === 'folder' && isOpen && node.children && (
        <FileTree
          nodes={node.children}
          activePath={activePath}
          onSelect={onSelect}
          depth={depth + 1}
        />
      )}
    </div>
  );
};
