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
  GitStatus,
  McpServer,
  TaskAttempt,
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
get: async (id: string): Promise<TaskAttempt | null> => {
    return await invoke("get_task_attempt", { id });
  },

  listForTask: async (taskId: string): Promise<TaskAttempt[]> => {
    return await invoke("list_task_attempts", { taskId });
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
  configureClaudeApiKey: async (apiKey: string): Promise<void> => {
    return await invoke("configure_claude_api_key", { apiKey });
  },

  configureGeminiApiKey: async (apiKey: string): Promise<void> => {
    return await invoke("configure_gemini_api_key", { apiKey });
  },

  saveImagesToTemp: async (base64Images: string[]): Promise<string[]> => {
    return await invoke("save_images_to_temp", { base64Images });
  },

  getRunningTasks: async (): Promise<string[]> => {
    return await invoke("get_running_tasks");
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