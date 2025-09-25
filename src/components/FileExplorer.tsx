import { useState, useEffect } from "react";
import { ChevronRight, ChevronDown, File, Folder, Plus, Trash, Edit, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { getFileTree, createFileOrFolder, deleteFileOrFolder, renameFileOrFolder, FileNode } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";


interface FileExplorerProps {
  onFileSelect: (filePath: string | null) => void;
  selectedFile: string | null;
  reloadKey?: number;
}

export function FileExplorer({ onFileSelect, selectedFile, reloadKey }: FileExplorerProps) {
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["data"]));
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [createType, setCreateType] = useState<'file' | 'folder'>('file');
  const [createParentPath, setCreateParentPath] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [itemToRename, setItemToRename] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const { toast } = useToast();

  // 加载文件树
  const loadFileTree = async () => {
    const tree = await getFileTree();
    setFileTree(tree);
  };

  useEffect(() => {
    loadFileTree();
  }, []);

  // 外部触发刷新
  useEffect(() => {
    if (reloadKey !== undefined) {
      loadFileTree();
    }
  }, [reloadKey]);

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

  // 处理创建文件/文件夹
  const handleCreate = async () => {
    if (!newItemName.trim()) return;
    
    const result = await createFileOrFolder(createParentPath, newItemName, createType);
    if (result.ok) {
      toast({
        title: "创建成功",
        description: `${createType === 'file' ? '文件' : '文件夹'} "${newItemName}" 创建成功`,
      });
      await loadFileTree();
      setShowCreateDialog(false);
      setNewItemName('');
    } else if (result.conflict) {
      toast({
        title: "创建失败",
        description: "同名文件或文件夹已存在，请更换名称",
        variant: "destructive",
      });
    } else {
      toast({
        title: "创建失败",
        description: "无法创建文件/文件夹",
        variant: "destructive",
      });
    }
  };

  // 处理删除
  const handleDelete = async () => {
    if (!itemToDelete) return;
    
    const success = await deleteFileOrFolder(itemToDelete);
    if (success) {
      toast({
        title: "删除成功",
        description: "文件/文件夹已删除",
      });
      await loadFileTree();
      setShowDeleteDialog(false);
      setItemToDelete(null);
      // 如果删除的是当前选中的文件，清除选择
      if (selectedFile === itemToDelete) {
        onFileSelect(null);
      }
    } else {
      toast({
        title: "删除失败",
        description: "无法删除文件/文件夹",
        variant: "destructive",
      });
    }
  };

  // 处理重命名
  const handleRename = async () => {
    if (!itemToRename || !renameValue.trim()) return;
    
    const result = await renameFileOrFolder(itemToRename, renameValue);
    if (result.ok) {
      toast({
        title: "重命名成功",
        description: "文件/文件夹已重命名",
      });
      await loadFileTree();
      setShowRenameDialog(false);
      setItemToRename(null);
      setRenameValue('');
    } else if (result.conflict) {
      toast({
        title: "重命名失败",
        description: "目标名称已存在，请更换名称",
        variant: "destructive",
      });
    } else {
      toast({
        title: "重命名失败",
        description: "无法重命名文件/文件夹",
        variant: "destructive",
      });
    }
  };

  const renderNode = (node: FileNode, depth = 0) => {
    const isExpanded = expandedFolders.has(node.path);
    const isSelected = selectedFile === node.path;
    const paddingLeft = depth * 16 + 8;

    return (
      <div key={node.path}>
        <div
          className={cn(
            "flex items-center py-1 px-2 cursor-pointer transition-colors group",
            "hover:bg-file-explorer-item-hover",
            isSelected && node.type === "file" && "bg-file-explorer-item-active text-primary-foreground"
          )}
          style={{ paddingLeft: `${paddingLeft}px` }}
        >
          <div
            className="flex items-center flex-1"
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
            <span className="text-sm truncate flex-1">{node.name}</span>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {node.type === "folder" && (
                <>
                  <DropdownMenuItem
                    onClick={() => {
                      setCreateType('file');
                      setCreateParentPath(node.path);
                      setShowCreateDialog(true);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    新建文件
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setCreateType('folder');
                      setCreateParentPath(node.path);
                      setShowCreateDialog(true);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    新建文件夹
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem
                onClick={() => {
                  setItemToRename(node.path);
                  setRenameValue(node.name);
                  setShowRenameDialog(true);
                }}
              >
                <Edit className="mr-2 h-4 w-4" />
                重命名
              </DropdownMenuItem>
              {node.path !== 'data' && (
                <DropdownMenuItem
                  onClick={() => {
                    setItemToDelete(node.path);
                    setShowDeleteDialog(true);
                  }}
                  className="text-red-600"
                >
                  <Trash className="mr-2 h-4 w-4" />
                  删除
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
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
    <>
      <div className="w-64 bg-file-explorer-bg border-r border-border h-full overflow-y-auto">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">文件浏览器</h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <Plus className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setCreateType('file');
                  setCreateParentPath('data');
                  setShowCreateDialog(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                新建文件
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setCreateType('folder');
                  setCreateParentPath('data');
                  setShowCreateDialog(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                新建文件夹
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="py-2">
          {fileTree.map(node => renderNode(node))}
        </div>
      </div>

      {/* 创建文件/文件夹对话框 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建{createType === 'file' ? '文件' : '文件夹'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">名称</Label>
              <Input
                id="name"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder={`输入${createType === 'file' ? '文件' : '文件夹'}名称`}
                onKeyPress={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              取消
            </Button>
            <Button onClick={handleCreate} disabled={!newItemName.trim()}>
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要删除此项目吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 重命名对话框 */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="rename">新名称</Label>
              <Input
                id="rename"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="输入新名称"
                onKeyPress={(e) => e.key === 'Enter' && handleRename()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)}>
              取消
            </Button>
            <Button onClick={handleRename} disabled={!renameValue.trim()}>
              重命名
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}