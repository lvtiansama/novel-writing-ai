import { useState, useEffect } from "react";
import { ChevronRight, ChevronDown, File, Folder } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileNode {
  name: string;
  type: "file" | "folder";
  path: string;
  children?: FileNode[];
}

interface FileExplorerProps {
  onFileSelect: (filePath: string) => void;
  selectedFile: string | null;
}

export function FileExplorer({ onFileSelect, selectedFile }: FileExplorerProps) {
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["data"]));

  // Mock file structure - in a real app, this would fetch from the server
  useEffect(() => {
    const mockData: FileNode[] = [
      {
        name: "data",
        type: "folder",
        path: "data",
        children: [
          {
            name: "novels",
            type: "folder", 
            path: "data/novels",
            children: [
              { name: "西游记.md", type: "file", path: "data/novels/西游记.md" },
              { name: "红楼梦.md", type: "file", path: "data/novels/红楼梦.md" },
              { name: "三国演义.md", type: "file", path: "data/novels/三国演义.md" }
            ]
          },
          {
            name: "characters",
            type: "folder",
            path: "data/characters", 
            children: [
              { name: "孙悟空.md", type: "file", path: "data/characters/孙悟空.md" },
              { name: "唐僧.md", type: "file", path: "data/characters/唐僧.md" },
              { name: "猪八戒.md", type: "file", path: "data/characters/猪八戒.md" }
            ]
          },
          {
            name: "settings",
            type: "folder",
            path: "data/settings",
            children: [
              { name: "config.json", type: "file", path: "data/settings/config.json" },
              { name: "prompts.md", type: "file", path: "data/settings/prompts.md" }
            ]
          },
          { name: "readme.md", type: "file", path: "data/readme.md" }
        ]
      }
    ];
    setFileTree(mockData);
  }, []);

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const renderNode = (node: FileNode, depth = 0) => {
    const isExpanded = expandedFolders.has(node.path);
    const isSelected = selectedFile === node.path;
    const paddingLeft = depth * 16 + 8;

    return (
      <div key={node.path}>
        <div
          className={cn(
            "flex items-center py-1 px-2 cursor-pointer transition-colors",
            "hover:bg-file-explorer-item-hover",
            isSelected && node.type === "file" && "bg-file-explorer-item-active text-primary-foreground"
          )}
          style={{ paddingLeft: `${paddingLeft}px` }}
          onClick={() => {
            if (node.type === "folder") {
              toggleFolder(node.path);
            } else {
              onFileSelect(node.path);
            }
          }}
        >
          {node.type === "folder" ? (
            <>
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 mr-1" />
              ) : (
                <ChevronRight className="w-4 h-4 mr-1" />
              )}
              <Folder className="w-4 h-4 mr-2 text-accent" />
            </>
          ) : (
            <File className="w-4 h-4 mr-2 ml-5 text-muted-foreground" />
          )}
          <span className="text-sm truncate">{node.name}</span>
        </div>
        {node.type === "folder" && isExpanded && node.children && (
          <div>
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-64 bg-file-explorer-bg border-r border-border h-full overflow-y-auto">
      <div className="p-3 border-b border-border">
        <h3 className="text-sm font-medium text-foreground">文件浏览器</h3>
      </div>
      <div className="py-2">
        {fileTree.map(node => renderNode(node))}
      </div>
    </div>
  );
}