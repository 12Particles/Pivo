# Pivo - 以任务为中心的 Vibe 编程环境

![License](https://img.shields.io/badge/License-MIT-blue.svg)
![Tauri](https://img.shields.io/badge/Tauri-2.x-orange.svg)
![React](https://img.shields.io/badge/React-18.x-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)
![Rust](https://img.shields.io/badge/Rust-1.x-red.svg)

[English](README.md) | [中文](README-zh.md)

> **以任务为中心的 Vibe 编程环境**

**Pivo** 基于Tauri、React和Rust构建，为基于Git的项目管理提供无缝体验，集成AI助手和终端功能。

![Pivo 界面](assets/screenshot.jpg)
*主界面展示了任务管理、文件变更和AI对话功能*

## ✨ 主要特性

### 🎯 项目管理
- **Git集成**：原生Git仓库支持，自动项目检测
- **多项目工作区**：同时管理多个项目
- **分支管理**：高级Git工作树支持，实现任务隔离

### 📋 任务管理
- **看板**：可视化任务管理，支持拖拽操作
- **任务层级**：支持父子任务关系
- **状态跟踪**：全面的任务状态和优先级管理
- **任务尝试**：为每次任务尝试提供隔离执行环境

### 🤖 AI集成
- **Claude助手**：集成Claude AI提供智能任务协助
- **Gemini支持**：支持替代AI模型以适应不同工作流程
- **对话历史**：每个任务的持久化AI对话跟踪
- **上下文感知**：AI理解项目结构和任务上下文

### 🖥️ 终端集成
- **嵌入式终端**：基于xterm.js的内置终端
- **进程管理**：跟踪和管理运行中的进程
- **命令历史**：持久化命令执行历史
- **多会话**：支持多个终端会话

### 🔧 高级功能
- **MCP服务器支持**：模型控制协议，支持可扩展的AI能力
- **文件监控**：实时文件系统监控
- **差异查看器**：内置代码差异可视化
- **合并请求集成**：支持GitLab和GitHub集成
- **多语言**：支持中英文界面

## 🚀 快速开始

### 环境要求

- **Node.js** (v18或更高版本)
- **Rust** (最新稳定版)
- **pnpm** (推荐的包管理器)
- **Git**

### 安装步骤

1. **克隆仓库**
   ```bash
   git clone https://github.com/yourusername/pivo.git
   cd pivo
   ```

2. **安装依赖**
   ```bash
   pnpm install
   ```

3. **安装Rust依赖**
   ```bash
   cd src-tauri
   cargo build
   cd ..
   ```

4. **运行开发模式**
   ```bash
   pnpm tauri dev
   ```

### 生产构建

```bash
# 构建应用程序
pnpm tauri build

# 构建的应用程序将在 src-tauri/target/release/bundle/ 目录中
```

## 🛠️ 开发指南

### 项目结构

```
pivo/
├── src/                    # React前端源码
│   ├── components/         # React组件
│   ├── lib/               # 工具库
│   ├── hooks/             # 自定义React钩子
│   ├── types/             # TypeScript类型定义
│   └── locales/           # 国际化翻译
├── src-tauri/             # Tauri/Rust后端
│   ├── src/               # Rust源码
│   ├── migrations/        # 数据库迁移
│   └── capabilities/      # Tauri能力配置
├── public/                # 静态资源
└── docs/                  # 文档
```

### 开发脚本

```bash
# 启动开发服务器
pnpm dev

# 仅构建前端
pnpm build

# 运行Tauri开发模式
pnpm tauri dev

# 构建Tauri应用程序
pnpm tauri build

# 运行测试（如果可用）
pnpm test

# 代码检查
pnpm lint
```

### 数据库

Pivo使用SQLite进行数据持久化。数据库在首次运行时自动初始化，包含以下表：

- `projects`：项目信息和Git仓库详情
- `tasks`：任务管理和层级结构
- `task_attempts`：具有隔离环境的任务执行尝试
- `execution_processes`：进程执行跟踪

### 配置

应用程序将配置存储在系统的应用数据目录中：

- **macOS**：`~/Library/Application Support/com.living.pivo/`
- **Windows**：`%APPDATA%\com.living.pivo\`
- **Linux**：`~/.local/share/com.living.pivo/`

## 🔧 集成

### Git平台集成

配置Git平台集成以支持合并请求：

- **GitLab**：具有`api`权限的个人访问令牌
- **GitHub**：具有`repo`权限的个人访问令牌

## 📖 使用方法

1. **创建项目**：选择Git仓库目录来创建新项目
2. **管理任务**：使用看板创建和组织任务
3. **AI协助**：点击任何任务开始AI对话获取指导
4. **执行任务**：使用集成终端或AI执行任务相关命令
5. **跟踪进度**：监控任务尝试和执行历史

## 🤝 贡献

我们欢迎贡献！请查看我们的[贡献指南](CONTRIBUTING.md)了解详情。

### 开发设置

1. Fork仓库
2. 创建功能分支：`git checkout -b feature/amazing-feature`
3. 进行更改并彻底测试
4. 提交更改：`git commit -m 'Add amazing feature'`
5. 推送到分支：`git push origin feature/amazing-feature`
6. 打开Pull Request

## 📝 许可证

本项目采用MIT许可证 - 详情请参见[LICENSE](LICENSE)文件。

## 🙏 致谢

- [Tauri](https://tauri.app/) 提供优秀的桌面应用框架
- [Radix UI](https://www.radix-ui.com/) 提供无障碍UI组件
- [Anthropic Claude](https://www.anthropic.com/) 提供AI能力
- [xterm.js](https://xtermjs.org/) 提供终端模拟

## ⭐ Star历史

[![Star History Chart](https://api.star-history.com/svg?repos=yourusername/pivo&type=Date)](https://star-history.com/#yourusername/pivo&Date)

## 💬 支持

如果这个项目对你有帮助，请考虑在GitHub上给它一个⭐！

如需支持，请提交issue
