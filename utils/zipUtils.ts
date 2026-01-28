
import JSZip from 'jszip';
import { FileNode } from '../types';

export async function extractZip(file: File): Promise<FileNode[]> {
  const zip = await JSZip.loadAsync(file);
  const fileMap: Record<string, FileNode> = {};
  const root: FileNode[] = [];

  // Create folder/file entries
  for (const [path, entry] of Object.entries(zip.files)) {
    const zipEntry = entry as JSZip.JSZipObject;
    const parts = path.split('/').filter(p => p !== '');
    if (parts.length === 0) continue;

    let currentPath = '';
    let currentChildren = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const nodePath = currentPath + (currentPath ? '/' : '') + part;

      let node = fileMap[nodePath];

      if (!node) {
        // Fix: Use cast zipEntry to access 'dir' property on line 26
        const type = (isLast && !zipEntry.dir) ? 'file' : 'folder';
        node = {
          name: part,
          path: nodePath,
          type,
          children: type === 'folder' ? [] : undefined
        };

        if (node.type === 'file') {
          if (node.name.match(/\.(tex|txt|bib|cls|sty|md|json)$/i)) {
            // Fix: Use cast zipEntry to access 'async' method on line 36
            node.content = await zipEntry.async('string');
          } else {
            // Fix: Use cast zipEntry to access 'async' method on line 38
            node.data = await zipEntry.async('uint8array');
          }
        }

        fileMap[nodePath] = node;
        currentChildren.push(node);
      }

      if (node.children) {
        currentChildren = node.children;
        currentPath = nodePath;
      }
    }
  }

  return root;
}

export async function createZip(nodes: FileNode[]): Promise<Blob> {
  const zip = new JSZip();

  const addToZip = (nList: FileNode[], folder: JSZip) => {
    for (const node of nList) {
      if (node.type === 'file') {
        if (node.content !== undefined) {
          folder.file(node.name, node.content);
        } else if (node.data) {
          folder.file(node.name, node.data);
        }
      } else if (node.children) {
        const subFolder = folder.folder(node.name);
        if (subFolder) addToZip(node.children, subFolder);
      }
    }
  };

  addToZip(nodes, zip);
  return await zip.generateAsync({ type: 'blob' });
}
