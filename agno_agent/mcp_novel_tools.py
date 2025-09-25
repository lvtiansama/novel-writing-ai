import aiohttp
import asyncio
import os
import shutil
from typing import List
from mcp.server.fastmcp import FastMCP  # 正确导入 FastMCP

# 初始化 MCP 服务器
server = FastMCP("mcp-novel-tools")

# 小说数据文件夹管理工具
NOVEL_DATA_DIR = "novel_data"

def is_safe_path(base_path, target_path):
    """检查目标路径是否在基础路径内，防止路径遍历攻击"""
    base_path = os.path.abspath(base_path)
    target_path = os.path.abspath(target_path)
    return target_path.startswith(base_path)

@server.tool()
async def manage_novel_files(
    action: str, 
    path: str = None, 
    content: str = None, 
    new_path: str = None,
    recursive: bool = False
) -> str:
    """管理小说数据文件夹中的文件和目录（支持所有文件类型）
    
    Args:
        action: 操作类型 - 
               'create_file'(创建任意类型文件), 
               'create_dir'(创建目录),
               'list'(列出指定路径的内容，默认为根目录),
               'read'(读取任意类型文件), 
               'update'(更新任意类型文件), 
               'rename'(重命名文件或目录),
               'delete'(删除文件或目录)
        path: 文件或目录路径（支持任意文件扩展名）
        content: 文件内容，用于create_file/update操作
        new_path: 新路径，用于rename操作
        recursive: 是否递归操作，用于delete目录时删除非空目录
        
    Returns:
        操作结果信息
    """
    
    # 首次调用时检查并创建novel_data文件夹
    if not os.path.exists(NOVEL_DATA_DIR):
        os.makedirs(NOVEL_DATA_DIR)
    
    # 安全检查：确保所有操作都在NOVEL_DATA_DIR内
    if path and not is_safe_path(NOVEL_DATA_DIR, os.path.join(NOVEL_DATA_DIR, path)):
        return "错误：路径越权访问尝试"
    
    if new_path and not is_safe_path(NOVEL_DATA_DIR, os.path.join(NOVEL_DATA_DIR, new_path)):
        return "错误：新路径越权访问尝试"
    
    if action == "create_file":
        if not path:
            return "错误：创建文件需要指定路径"
        if not content:
            return "错误：创建文件需要提供内容"
        
        filepath = os.path.join(NOVEL_DATA_DIR, path)
        if os.path.exists(filepath):
            return f"错误：路径 {path} 已存在"
        
        # 确保父目录存在
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return f"已创建文件：{path}"
    
    elif action == "create_dir":
        if not path:
            return "错误：创建目录需要指定路径"
        
        dirpath = os.path.join(NOVEL_DATA_DIR, path)
        if os.path.exists(dirpath):
            return f"错误：目录 {path} 已存在"
        
        os.makedirs(dirpath)
        return f"已创建目录：{path}"
    
    elif action == "list":
        list_path = NOVEL_DATA_DIR
        if path:
            list_path = os.path.join(NOVEL_DATA_DIR, path)
            
        if not os.path.exists(list_path):
            return f"错误：路径 {path} 不存在"
        
        if not os.path.isdir(list_path):
            return f"错误：{path} 不是目录"
        
        items = os.listdir(list_path)
        result = []
        for item in items:
            full_path = os.path.join(list_path, item)
            if os.path.isdir(full_path):
                result.append(f"[目录] {item}")
            else:
                result.append(f"[文件] {item}")
        return "\n".join(result)
    
    elif action == "read":
        if not path:
            return "错误：读取文件需要指定路径"
        
        filepath = os.path.join(NOVEL_DATA_DIR, path)
        if not os.path.exists(filepath):
            return f"错误：文件 {path} 不存在"
        
        if not os.path.isfile(filepath):
            return f"错误：{path} 不是文件"
        
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        return content
    
    elif action == "update":
        if not path:
            return "错误：更新文件需要指定路径"
        if not content:
            return "错误：更新文件需要提供新内容"
        
        filepath = os.path.join(NOVEL_DATA_DIR, path)
        if not os.path.exists(filepath):
            return f"错误：文件 {path} 不存在"
        
        if not os.path.isfile(filepath):
            return f"错误：{path} 不是文件"
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return f"已更新文件：{path}"
    
    elif action == "rename":
        if not path:
            return "错误：需要指定原路径"
        if not new_path:
            return "错误：需要指定新路径"
        
        old_fullpath = os.path.join(NOVEL_DATA_DIR, path)
        new_fullpath = os.path.join(NOVEL_DATA_DIR, new_path)
        
        if not os.path.exists(old_fullpath):
            return f"错误：原路径 {path} 不存在"
        
        if os.path.exists(new_fullpath):
            return f"错误：新路径 {new_path} 已存在"
        
        os.rename(old_fullpath, new_fullpath)
        return f"已将 {path} 重命名为 {new_path}"
    
    elif action == "delete":
        if not path:
            return "错误：删除需要指定路径"
        
        target_path = os.path.join(NOVEL_DATA_DIR, path)
        if not os.path.exists(target_path):
            return f"错误：路径 {path} 不存在"
        
        if os.path.isfile(target_path):
            os.remove(target_path)
            return f"已删除文件：{path}"
        elif os.path.isdir(target_path):
            if recursive:
                shutil.rmtree(target_path)
                return f"已递归删除目录：{path}"
            else:
                try:
                    os.rmdir(target_path)
                    return f"已删除空目录：{path}"
                except OSError:
                    return "错误：目录非空，请使用 recursive=True 参数"
        else:
            return f"错误：{path} 不是文件或目录"
    
    else:
        return "错误：不支持的操作类型"

if __name__ == "__main__":
    server.run(transport="stdio")