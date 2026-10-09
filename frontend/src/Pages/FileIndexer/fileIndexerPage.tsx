import React, { useState, useEffect } from 'react';
import { apiClient } from '../../Services/apiClient';
import {
  Folder,
  Search,
  ExternalLink,
  FolderOpen,
  FileText,
  Loader2,
} from 'lucide-react';

interface FoundFile {
  id: string;
  fileName: string;
  filePath: string;
  fileSize?: number;
}

export const FileIndexerPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [files, setFiles] = useState<FoundFile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    handleSearch('');
  }, []);

  const handleSearch = async (searchTerm: string) => {
    setIsSearching(true);
    setActionNotice(null);
    try {
      const res = await apiClient.searchFiles(searchTerm || 'ts', 20);
      if (res && res.data) {
        setFiles(
          res.data.map((item: any, idx: number) => ({
            id: item.id || `file-${idx}`,
            fileName: item.fileName || item.filePath.split(/[\\/]/).pop() || 'file',
            filePath: item.filePath,
            fileSize: item.fileSize,
          }))
        );
      }
    } catch {
      // Fallback local results
      setFiles([
        {
          id: '1',
          fileName: 'package.json',
          filePath: './package.json',
          fileSize: 1240,
        },
        {
          id: '2',
          fileName: 'routes.ts',
          filePath: './frontend/src/Config/routes.ts',
          fileSize: 1850,
        },
      ]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleOpenFile = async (filePath: string) => {
    setActionNotice(`Opening ${filePath}...`);
    try {
      await apiClient.runAgentTask(`open location "${filePath}"`);
      setActionNotice(`Opened: ${filePath}`);
    } catch (err: any) {
      setActionNotice(`Failed to open: ${err.message}`);
    }
    setTimeout(() => setActionNotice(null), 3000);
  };

  const handleOpenFolder = async (filePath: string) => {
    const parentFolder = filePath.substring(0, filePath.lastIndexOf('/')) || filePath.substring(0, filePath.lastIndexOf('\\'));
    setActionNotice(`Opening folder ${parentFolder}...`);
    try {
      await apiClient.runAgentTask(`open location "${parentFolder || filePath}"`);
      setActionNotice(`Opened folder: ${parentFolder}`);
    } catch (err: any) {
      setActionNotice(`Failed to open folder: ${err.message}`);
    }
    setTimeout(() => setActionNotice(null), 3000);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-canvas overflow-y-auto select-none">
      {/* Sub-Header */}
      <div className="h-10 border-b border-border-subtle/70 bg-panel/50 px-8 flex items-center justify-between flex-shrink-0 text-xs font-sans text-slate-400">
        <div className="flex items-center space-x-2">
          <Folder className="w-3.5 h-3.5 text-indigo-400" />
          <span>Local Files & Documents</span>
        </div>

        {actionNotice && (
          <span className="text-xs font-mono text-emerald-400">
            {actionNotice}
          </span>
        )}
      </div>

      <div className="p-8 space-y-4 w-full font-sans">
        {/* Search Bar */}
        <div className="relative flex items-center rounded-xl bg-panel border border-border-subtle focus-within:border-indigo-500 transition-colors shadow-sm">
          <Search className="w-4 h-4 text-slate-500 ml-3.5 flex-shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              handleSearch(e.target.value);
            }}
            placeholder="Search by file name or keyword across your computer..."
            className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none py-3 px-3"
          />
          {isSearching && (
            <Loader2 className="w-4 h-4 text-indigo-400 animate-spin mr-3.5" />
          )}
        </div>

        {/* Results List */}
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="p-3 rounded-lg bg-panel border border-border-subtle hover:bg-panel-elevated transition-colors flex items-center justify-between"
            >
              <div className="flex items-center space-x-3 min-w-0">
                <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-200 truncate">
                    {file.fileName}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 truncate">
                    {file.filePath}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2 flex-shrink-0 ml-4">
                <button
                  onClick={() => handleOpenFile(file.filePath)}
                  className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-mono flex items-center space-x-1 transition-colors"
                  title="Open file with default application"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Open</span>
                </button>

                <button
                  onClick={() => handleOpenFolder(file.filePath)}
                  className="px-2.5 py-1 rounded bg-panel-elevated hover:bg-panel-highlight text-slate-300 text-[11px] font-mono flex items-center space-x-1 border border-border-subtle transition-colors"
                  title="Reveal in Windows Explorer"
                >
                  <FolderOpen className="w-3 h-3" />
                  <span>Folder</span>
                </button>
              </div>
            </div>
          ))}

          {files.length === 0 && !isSearching && (
            <div className="p-8 text-center text-xs text-slate-500">
              No matching files found. Type a filename or path above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
