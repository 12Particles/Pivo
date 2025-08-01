export interface Task {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  parent_task_id?: string;
  assignee?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export enum TaskStatus {
  Backlog = "Backlog",
  Working = "Working",
  Reviewing = "Reviewing",
  Done = "Done",
  Cancelled = "Cancelled",
}

export enum TaskPriority {
  Low = "Low",
  Medium = "Medium",
  High = "High",
  Urgent = "Urgent",
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  path: string;
  git_repo?: string;
  git_provider?: string;
  main_branch: string;
  setup_script?: string;
  dev_script?: string;
  created_at: string;
  updated_at: string;
  last_opened?: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  path: string;
  git_repo?: string;
  main_branch?: string;
  setup_script?: string;
  dev_script?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  path?: string;
  git_repo?: string;
  main_branch?: string;
  setup_script?: string;
  dev_script?: string;
}

export interface CreateTaskRequest {
  project_id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  parent_task_id?: string;
  assignee?: string;
  tags?: string[];
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee?: string;
  tags?: string[];
}

export interface TaskAttempt {
  id: string;
  task_id: string;
  worktree_path: string;
  branch: string;
  base_branch: string;
  base_commit?: string;
  executor?: string;
  status: AttemptStatus;
  last_sync_commit?: string;
  last_sync_at?: string;
  created_at: string;
  completed_at?: string;
  claude_session_id?: string;
}

export enum AttemptStatus {
  Running = "running",
  Success = "success",
  Failed = "failed",
  Cancelled = "cancelled",
}

export interface ExecutionProcess {
  id: string;
  task_attempt_id: string;
  process_type: ProcessType;
  executor_type?: string;
  status: ProcessStatus;
  command: string;
  args?: string;
  working_directory: string;
  stdout?: string;
  stderr?: string;
  exit_code?: number;
  started_at: string;
  completed_at?: string;
}

export enum ProcessType {
  SetupScript = "setupscript",
  CodingAgent = "codingagent",
  DevServer = "devserver",
  Terminal = "terminal",
}

export enum ProcessStatus {
  Running = "running",
  Completed = "completed",
  Failed = "failed",
  Killed = "killed",
}

export interface ConversationEntry {
  id: string;
  type: "user" | "assistant" | "system" | "tool_use" | "tool_result";
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface DiffComment {
  id: string;
  taskAttemptId: string;
  filePath: string;
  lineNumber: number;
  content: string;
  createdAt: Date;
  resolved: boolean;
}

export interface TaskTemplate {
  id: string;
  name: string;
  description?: string;
  template: string;
  projectId?: string;
  isGlobal: boolean;
}

export interface GitStatus {
  modified: string[];
  added: string[];
  deleted: string[];
  untracked: string[];
}



export interface McpServer {
  id: string;
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  capabilities: McpCapabilities;
  status: McpServerStatus;
}

export interface McpCapabilities {
  tools: boolean;
  resources: boolean;
  prompts: boolean;
}

export enum McpServerStatus {
  Stopped = "Stopped",
  Starting = "Starting",
  Running = "Running",
  Error = "Error",
}

export interface McpTool {
  name: string;
  description: string;
  parameters: any;
}

export interface McpResource {
  name: string;
  uri: string;
  description?: string;
  mime_type?: string;
}

export interface McpPrompt {
  name: string;
  description?: string;
  arguments: McpPromptArgument[];
}

export interface McpPromptArgument {
  name: string;
  description?: string;
  required: boolean;
}

export interface ToolExecutionRequest {
  server_id: string;
  tool_name: string;
  arguments: any;
}

export interface ToolExecutionResult {
  content: ToolContent[];
  is_error: boolean;
}

export type ToolContent = 
  | { type: "text"; text: string }
  | { type: "image"; data: string; mime_type: string }
  | { type: "resource"; uri: string; text?: string };

export interface CodingAgentExecutionContext {
  id: string;
  task_id: string;
  executor_type: CodingAgentType;
  working_directory: string;
  claude_session_id?: string;  // For resuming Claude conversations
}

export interface CodingAgentExecution {
  id: string;
  task_id: string;
  executor_type: CodingAgentType;
  working_directory: string;
  status: CodingAgentExecutionStatus;
  created_at: string;
}

export enum CodingAgentType {
  ClaudeCode = "claude_code",
  GeminiCli = "gemini_cli",
}

export enum CodingAgentExecutionStatus {
  Starting = "Starting",
  Running = "Running",
  Completed = "Completed",
  Error = "Error",
}

export interface CodingAgentOutput {
  execution_id: string;
  output_type: CodingAgentOutputType;
  content: string;
  timestamp: string;
}

export enum CodingAgentOutputType {
  Stdout = "Stdout",
  Stderr = "Stderr",
  System = "System",
}

export interface GitInfo {
  is_git_repo: boolean;
  current_branch?: string;
  remote_url?: string;
  has_uncommitted_changes: boolean;
  file_stats: FileStats;
  recent_commits: CommitInfo[];
}

export interface FileStats {
  modified: number;
  added: number;
  deleted: number;
  untracked: number;
}

export interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  timestamp: string;
}

// Re-export merge request types
export type { 
  MergeRequest, 
  MergeRequestInfo, 
  MergeRequestState, 
  MergeStatus, 
  PipelineStatus 
} from '@/lib/types/mergeRequest';

// Re-export command types
export type {
  Command,
  CommandSearchResult
} from './command';