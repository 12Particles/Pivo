# Git LFS 环境变量问题修复

## 问题描述
在发布版本中（非通过 `pnpm tauri dev` 运行时），git-lfs 命令找不到。这是因为 macOS 应用程序启动时不会加载用户的 shell 环境变量，所以通过 Homebrew 安装的工具（如 git-lfs）不在 PATH 中。

## 解决方案
创建了一个通用的命令执行封装，确保在 macOS 上通过 login shell 执行命令，从而加载用户的完整环境变量。

## 修改内容

### 1. 创建命令执行工具模块
- 文件：`src/utils/command.rs`
- 功能：
  - `execute_command()` - 通用命令执行函数
  - `execute_git()` - 专门用于执行 git 命令
  - 在 macOS 上通过 `/bin/bash -l -c` 执行命令以加载用户环境

### 2. 更新的文件
- `src/services/git_service.rs` - 所有 git 命令改用 `execute_git()`
- `src/services/github_service.rs` - GitHub 相关的 git 操作
- `src/services/gitlab_service.rs` - GitLab 相关的 git 操作
- `src/commands/projects.rs` - 项目扫描中的 git 命令
- `src/commands/git.rs` - git 相关的 Tauri 命令

### 3. 添加的依赖
- `shell-escape = "0.1"` - 用于安全地转义 shell 命令参数

## 技术细节

### macOS 特定处理
```rust
#[cfg(target_os = "macos")]
{
    // 通过 login shell 执行命令
    let mut cmd = Command::new("/bin/bash");
    cmd.arg("-l")  // Login shell，加载 ~/.bash_profile 等
       .arg("-c")
       .arg(&shell_command);
}
```

### 其他平台
在非 macOS 平台上，命令直接执行，无需特殊处理。

## 测试
- 编译通过：`cargo check`
- 所有 git 相关功能应该在发布版本中正常工作
- git-lfs 等通过 Homebrew 安装的工具现在可以被正确找到

## 未来改进
如果其他服务（如 MCP 服务、编码代理等）也需要访问用户环境变量，可以使用相同的 `execute_command()` 函数。