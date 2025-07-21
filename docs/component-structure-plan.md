# Component Directory Structure Reorganization Plan

## Current Issues
- Task-related components are mixed in tasks/ directory
- Version control components are scattered (git/, github/, gitlab/)
- No clear functional grouping

## Proposed New Structure

```
src/components/
├── tasks/                        # 任务管理模块
│   ├── kanban/                  # 看板功能
│   │   ├── TaskKanbanBoard.tsx
│   │   └── TaskCard.tsx
│   ├── conversation/            # 会话功能 (已存在)
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── utils/
│   │   └── types.ts
│   ├── dialogs/                 # 任务相关对话框
│   │   ├── CreateTaskDialog.tsx
│   │   └── EditTaskDialog.tsx
│   ├── details/                 # 任务详情
│   │   └── TaskDetailsPanel.tsx
│   └── TaskConversation.tsx     # 主会话组件
│
├── vcs/                         # 版本控制系统 (Version Control System)
│   ├── common/                  # 通用 Git 组件
│   │   ├── DiffViewer.tsx
│   │   ├── EnhancedDiffViewer.tsx
│   │   ├── FileTreeDiff.tsx
│   │   ├── GitStatusPanel.tsx
│   │   ├── WorktreeManager.tsx
│   │   ├── CommentDialog.tsx
│   │   └── CommentPanel.tsx
│   ├── github/                  # GitHub 特定功能
│   │   ├── GitHubAuthDialog.tsx
│   │   ├── CreatePullRequestDialog.tsx
│   │   └── PullRequestList.tsx
│   ├── gitlab/                  # GitLab 特定功能
│   │   ├── CreateMergeRequestDialog.tsx
│   │   └── PipelineViewer.tsx
│   └── MergeRequestList.tsx     # 通用 MR/PR 列表
│
├── projects/                    # 项目管理 (保持不变)
├── settings/                    # 设置管理 (保持不变)
├── ai/                         # AI 助手 (保持不变)
├── terminal/                   # 终端功能 (保持不变)
├── logs/                       # 日志查看 (保持不变)
├── mcp/                        # MCP 服务器管理 (保持不变)
├── integration/                # 集成面板 (保持不变)
├── layout/                     # 布局组件 (保持不变)
└── ui/                         # 通用 UI 组件 (保持不变)
```

## Benefits
1. Clear functional grouping
2. Better code organization
3. Easier to find components
4. More maintainable structure