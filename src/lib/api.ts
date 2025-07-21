import { invoke } from "@tauri-apps/api/core";
import { 
  Task, 
  Project, 
  TaskStatus, 
  CreateTaskRequest, 
  UpdateTaskRequest,
  CreateProjectRequest,
  UpdateProjectRequest,
  ExecutionProcess,
  ProcessType,
  GitStatus,
  TerminalSession,
  ExecutorConfig,
  ExecutorResponse,
  ExecutorSession,
  McpServer,
  ToolExecutionRequest,
  CliExecution,
  GitInfo,
  TaskAttempt,
  AttemptStatus
} from "@/types";

// Task API
export const taskApi = {
  create: async (request: CreateTaskRequest): Promise<Task> => {
    return await invoke("create_task", { request });
  },

  get: async (id: string): Promise<Task | null> => {
    return await invoke("get_task", { id });
  },

  list: async (projectId: string): Promise<Task[]> => {
    return await invoke("list_tasks", { projectId });
  },

  update: async (id: string, request: UpdateTaskRequest): Promise<Task> => {
    return await invoke("update_task", { id, request });
  },

  delete: async (id: string): Promise<void> => {
    return await invoke("delete_task", { id });
  },

  updateStatus: async (id: string, status: TaskStatus): Promise<Task> => {
    return await invoke("update_task_status", { id, status });
  },
};

// Task Attempt API
export const taskAttemptApi = {
  create: async (taskId: string, executor?: string, baseBranch?: string): Promise<TaskAttempt> => {
    const request = {
      task_id: taskId,
      executor: executor || null,
      base_branch: baseBranch || null
    };
    return await invoke("create_task_attempt", { request });
  },

  get: async (id: string): Promise<TaskAttempt | null> => {
    return await invoke("get_task_attempt", { id });
  },

  listForTask: async (taskId: string): Promise<TaskAttempt[]> => {
    return await invoke("list_task_attempts", { taskId });
  },

  updateStatus: async (id: string, status: AttemptStatus): Promise<TaskAttempt> => {
    return await invoke("update_attempt_status", { id, status });
  },

  saveConversation: async (attemptId: string, messages: any[]): Promise<any> => {
    const request = { messages };
    return await invoke("save_attempt_conversation", { attemptId, request });
  },

  getConversation: async (attemptId: string): Promise<any> => {
    return await invoke("get_attempt_conversation", { attemptId });
  },

  updateClaudeSessionId: async (attemptId: string, claudeSessionId: string): Promise<void> => {
    return await invoke("update_attempt_claude_session", { attemptId, claudeSessionId });
  },
};

// Project API
export const projectApi = {
  create: async (request: CreateProjectRequest): Promise<Project> => {
    return await invoke("create_project", { request });
  },

  get: async (id: string): Promise<Project | null> => {
    return await invoke("get_project", { id });
  },

  list: async (): Promise<Project[]> => {
    return await invoke("list_projects");
  },

  update: async (id: string, request: UpdateProjectRequest): Promise<Project> => {
    return await invoke("update_project", { id, request });
  },

  delete: async (id: string): Promise<void> => {
    return await invoke("delete_project", { id });
  },
  
  refreshAllGitProviders: async (): Promise<Project[]> => {
    return await invoke("refresh_all_git_providers");
  },
};

// Process API
export const processApi = {
  spawn: async (
    taskAttemptId: string,
    processType: ProcessType,
    command: string,
    args: string[],
    workingDirectory: string
  ): Promise<string> => {
    return await invoke("spawn_process", {
      taskAttemptId,
      processType,
      command,
      args,
      workingDirectory,
    });
  },

  kill: async (processId: string): Promise<void> => {
    return await invoke("kill_process", { processId });
  },

  get: async (id: string): Promise<ExecutionProcess | null> => {
    return await invoke("get_process", { id });
  },

  listForAttempt: async (taskAttemptId: string): Promise<ExecutionProcess[]> => {
    return await invoke("list_processes_for_attempt", { taskAttemptId });
  },
};

// Git API
export const gitApi = {
  createWorktree: async (
    repoPath: string,
    taskId: string,
    baseBranch: string
  ): Promise<string> => {
    return await invoke("create_worktree", { 
      repoPath: repoPath, 
      branchName: taskId, 
      baseBranch: baseBranch 
    });
  },

  removeWorktree: async (repoPath: string, worktreePath: string): Promise<void> => {
    return await invoke("remove_worktree", { 
      repoPath: repoPath, 
      worktreePath: worktreePath 
    });
  },

  getCurrentBranch: async (repoPath: string): Promise<string> => {
    return await invoke("get_current_branch", { repoPath });
  },

  listBranches: async (repoPath: string): Promise<string[]> => {
    return await invoke("list_branches", { repoPath });
  },

  getStatus: async (repoPath: string): Promise<GitStatus> => {
    return await invoke("get_git_status", { repoPath });
  },

  stageFiles: async (repoPath: string, files: string[]): Promise<void> => {
    return await invoke("stage_files", { repoPath, files });
  },

  commit: async (repoPath: string, message: string): Promise<string> => {
    return await invoke("commit_changes", { repoPath, message });
  },

  push: async (repoPath: string, branch: string, force: boolean = false): Promise<void> => {
    return await invoke("push_branch", { repoPath, branch, force });
  },

  getDiff: async (repoPath: string, staged: boolean = false): Promise<string> => {
    return await invoke("get_diff", { repoPath, staged });
  },

  listAllFiles: async (directoryPath: string): Promise<any[]> => {
    return await invoke("list_all_files", { repoPath: directoryPath });
  },

  readFileContent: async (repoPath: string, filePath: string): Promise<string> => {
    return await invoke("read_file_content", { repoPath: repoPath, filePath: filePath });
  },

  getFileFromRef: async (repoPath: string, fileRef: string): Promise<string> => {
    return await invoke("get_file_from_ref", { repoPath: repoPath, fileRef: fileRef });
  },
};

// Terminal API
export const terminalApi = {
  createSession: async (
    taskAttemptId: string,
    rows: number,
    cols: number,
    workingDirectory: string
  ): Promise<TerminalSession> => {
    return await invoke("create_terminal_session", {
      taskAttemptId,
      rows,
      cols,
      workingDirectory,
    });
  },

  write: async (sessionId: string, data: string): Promise<void> => {
    return await invoke("write_to_terminal", { sessionId, data });
  },

  resize: async (sessionId: string, rows: number, cols: number): Promise<void> => {
    return await invoke("resize_terminal", { sessionId, rows, cols });
  },

  close: async (sessionId: string): Promise<void> => {
    return await invoke("close_terminal_session", { sessionId });
  },

  listSessions: async (): Promise<string[]> => {
    return await invoke("list_terminal_sessions");
  },
};

// MCP API
export const mcpApi = {
  registerServer: async (
    name: string,
    command: string,
    args: string[],
    env: Record<string, string>
  ): Promise<string> => {
    return await invoke("register_mcp_server", { name, command, args, env });
  },

  startServer: async (serverId: string): Promise<void> => {
    return await invoke("start_mcp_server", { serverId });
  },

  stopServer: async (serverId: string): Promise<void> => {
    return await invoke("stop_mcp_server", { serverId });
  },

  listServers: async (): Promise<McpServer[]> => {
    return await invoke("list_mcp_servers");
  },

  getServer: async (serverId: string): Promise<McpServer | null> => {
    return await invoke("get_mcp_server", { serverId });
  },

  sendRequest: async (
    serverId: string,
    method: string,
    params?: any
  ): Promise<string> => {
    return await invoke("send_mcp_request", { serverId, method, params });
  },

  listTools: async (serverId: string): Promise<string> => {
    return await invoke("list_mcp_tools", { serverId });
  },

  executeTool: async (request: ToolExecutionRequest): Promise<string> => {
    return await invoke("execute_mcp_tool", { request });
  },

  listResources: async (serverId: string): Promise<string> => {
    return await invoke("list_mcp_resources", { serverId });
  },

  readResource: async (serverId: string, uri: string): Promise<string> => {
    return await invoke("read_mcp_resource", { serverId, uri });
  },

  listPrompts: async (serverId: string): Promise<string> => {
    return await invoke("list_mcp_prompts", { serverId });
  },

  getPrompt: async (
    serverId: string,
    name: string,
    args: any
  ): Promise<string> => {
    return await invoke("get_mcp_prompt", { serverId, name, arguments: args });
  },
};

// CLI API
export const cliApi = {
  // New simplified API
  executeClaudeCommand: async (
    taskId: string,
    workingDirectory: string,
    message: string,
    claudeSessionId?: string,
    projectPath?: string
  ): Promise<void> => {
    return await invoke("execute_claude_command", {
      taskId,
      workingDirectory,
      message,
      claudeSessionId,
      projectPath,
    });
  },

  // Execution management API
  startClaudeExecution: async (
    taskId: string,
    workingDirectory: string,
    projectPath?: string,
    storedClaudeSessionId?: string
  ): Promise<CliExecution> => {
    return await invoke("start_claude_execution", {
      taskId,
      workingDirectory,
      projectPath,
      storedClaudeSessionId,
    });
  },

  startGeminiExecution: async (
    taskId: string,
    workingDirectory: string,
    contextFiles: string[]
  ): Promise<CliExecution> => {
    return await invoke("start_gemini_execution", {
      taskId,
      workingDirectory,
      contextFiles,
    });
  },

  sendInput: async (executionId: string, input: string): Promise<void> => {
    return await invoke("send_cli_input", { executionId, input });
  },

  stopExecution: async (executionId: string): Promise<void> => {
    return await invoke("stop_cli_execution", { executionId });
  },

  getExecution: async (executionId: string): Promise<CliExecution | null> => {
    return await invoke("get_cli_execution", { executionId });
  },

  listExecutions: async (): Promise<CliExecution[]> => {
    return await invoke("list_cli_executions");
  },

  configureClaudeApiKey: async (apiKey: string): Promise<void> => {
    return await invoke("configure_claude_api_key", { apiKey });
  },

  configureGeminiApiKey: async (apiKey: string): Promise<void> => {
    return await invoke("configure_gemini_api_key", { apiKey });
  },

  saveImagesToTemp: async (base64Images: string[]): Promise<string[]> => {
    return await invoke("save_images_to_temp", { base64Images });
  },
};

// AI API
export const aiApi = {
  initSession: async (
    executorType: string,
    taskId: string,
    initialPrompt: string,
    config: ExecutorConfig
  ): Promise<string> => {
    return await invoke("init_ai_session", {
      executorType,
      taskId,
      initialPrompt,
      config,
    });
  },

  sendMessage: async (
    sessionId: string,
    message: string,
    executorConfig: ExecutorConfig
  ): Promise<ExecutorResponse> => {
    return await invoke("send_ai_message", { sessionId, message, executorConfig });
  },

  getSession: async (sessionId: string): Promise<ExecutorSession> => {
    return await invoke("get_ai_session", { sessionId });
  },

  listSessions: async (): Promise<string[]> => {
    return await invoke("list_ai_sessions");
  },

  closeSession: async (sessionId: string): Promise<void> => {
    return await invoke("close_ai_session", { sessionId });
  },
};

// Git Info API
export const gitInfoApi = {
  extractGitInfo: async (path: string): Promise<GitInfo> => {
    return await invoke("extract_git_info_from_path", { path });
  },
};

// Logging API
export const loggingApi = {
  getLogContent: async (lines?: number): Promise<string> => {
    return await invoke("get_log_content", { lines });
  },

  getLogPath: async (): Promise<string> => {
    return await invoke("get_log_path");
  },

  openLogFile: async (): Promise<void> => {
    return await invoke("open_log_file");
  },

  clearLogs: async (): Promise<void> => {
    return await invoke("clear_logs");
  },
};