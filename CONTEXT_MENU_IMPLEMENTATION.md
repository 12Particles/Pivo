# 文件列表右键菜单实现总结

## 概述
为 Pivo 项目的文件列表组件（FileTreeDiff 和 GitStatusPanel）添加了右键菜单功能。

## 实现的功能

### 右键菜单项
1. **查看差异 (View Diff)** - 仅对文件显示，打开文件差异视图
2. **在编辑器中打开 (Open in Editor)** - 使用系统默认编辑器打开文件
3. **复制路径 (Copy Path)** - 复制文件完整路径到剪贴板
4. **复制文件名 (Copy Filename)** - 复制文件名到剪贴板
5. **在文件管理器中显示 (Show in File Manager)** - 在系统文件管理器中显示文件
6. **在此处打开终端 (Open Terminal Here)** - 在文件/文件夹位置打开终端

## 修改的文件

### 前端文件
1. **src/lib/file-operations.ts** - 新建文件，封装文件操作功能
2. **src/hooks/use-file-context-menu.tsx** - 新建文件，提供右键菜单的自定义 Hook
3. **src/features/vcs/components/common/FileTreeDiff.tsx** - 修改，添加右键菜单支持
4. **src/features/vcs/components/common/GitStatusPanel.tsx** - 修改，添加右键菜单支持

### 后端文件
1. **src-tauri/src/commands/system.rs** - 修改，添加 show_in_file_manager 命令
2. **src-tauri/src/lib.rs** - 修改，注册新的 Tauri 命令

## 技术实现细节

### 前端
- 使用 Radix UI 的 DropdownMenu 组件实现右键菜单
- 通过 onContextMenu 事件拦截右键点击
- 使用 Tauri 的 plugin-shell 和 invoke API 调用系统功能

### 后端
- 利用现有的 execute_command 工具函数执行系统命令
- 支持 macOS、Windows 和 Linux 三个平台
- 使用平台特定的命令实现文件管理器和终端功能

## 平台支持

### macOS
- 文件管理器：使用 `open -R` 命令在 Finder 中显示文件
- 终端：支持 iTerm2 和 Terminal.app

### Windows
- 文件管理器：使用 `explorer /select,` 命令
- 终端：支持 Windows Terminal 和 CMD

### Linux
- 文件管理器：支持 Nautilus (GNOME)、Dolphin (KDE)、Thunar (XFCE)
- 终端：支持 x-terminal-emulator、gnome-terminal

## 使用方式
用户可以通过右键点击文件列表中的任何文件或文件夹来访问上下文菜单。菜单会根据点击的项目类型（文件或文件夹）显示相应的选项。