// Metadata types for different message types

export interface AssistantMetadata {
  thinking?: string;
  id?: string;
}

export interface ToolUseMetadata {
  toolName: string;
  toolUseId?: string;
  structured: any;
}

export interface ToolResultMetadata {
  toolName: string;
  toolUseId?: string;
  error?: boolean;
}

export interface ExecutionCompleteMetadata {
  success: boolean;
  summary?: string;
  duration_ms?: number;
  cost_usd?: number;
}

export interface UserMetadata {
  images?: string[];
}

// Union type for all metadata
export type MessageMetadata = 
  | AssistantMetadata 
  | ToolUseMetadata 
  | ToolResultMetadata 
  | ExecutionCompleteMetadata 
  | UserMetadata;

// Type guards
export function isAssistantMetadata(metadata: any): metadata is AssistantMetadata {
  return metadata && (metadata.thinking !== undefined || metadata.id !== undefined);
}

export function isToolUseMetadata(metadata: any): metadata is ToolUseMetadata {
  return metadata && metadata.toolName !== undefined && metadata.structured !== undefined;
}

export function isToolResultMetadata(metadata: any): metadata is ToolResultMetadata {
  return metadata && metadata.toolName !== undefined && !metadata.structured;
}

export function isExecutionCompleteMetadata(metadata: any): metadata is ExecutionCompleteMetadata {
  return metadata && metadata.success !== undefined;
}

export function isUserMetadata(metadata: any): metadata is UserMetadata {
  return metadata && metadata.images !== undefined;
}