/**
 * MCP (Model Context Protocol) API service
 */

import { mcpApi as originalMcpApi } from '@/lib/api';
import { McpServer, ToolExecutionRequest } from '@/types';
import { logger } from '@/lib/logger';

export class McpApi {
  private api = originalMcpApi;
  
  /**
   * Register a new MCP server
   */
  async registerServer(
    name: string,
    command: string,
    args: string[],
    env: Record<string, string>
  ): Promise<string> {
    logger.info('Registering MCP server', { name, command });
    return this.api.registerServer(name, command, args, env);
  }
  
  // Alias methods for compatibility
  async register(params: { name: string; command: string; args: string[]; env: Record<string, string> }): Promise<string> {
    return this.registerServer(params.name, params.command, params.args, params.env);
  }
  
  /**
   * Start an MCP server
   */
  async startServer(serverId: string): Promise<void> {
    logger.info('Starting MCP server', { serverId });
    return this.api.startServer(serverId);
  }
  
  // Alias for compatibility
  async start(serverId: string): Promise<void> {
    return this.startServer(serverId);
  }
  
  /**
   * Stop an MCP server
   */
  async stopServer(serverId: string): Promise<void> {
    logger.info('Stopping MCP server', { serverId });
    return this.api.stopServer(serverId);
  }
  
  // Alias for compatibility
  async stop(serverId: string): Promise<void> {
    return this.stopServer(serverId);
  }
  
  /**
   * List all registered MCP servers
   */
  async listServers(): Promise<McpServer[]> {
    return this.api.listServers();
  }
  
  // Alias for compatibility
  async list(): Promise<McpServer[]> {
    return this.listServers();
  }
  
  /**
   * Get a specific MCP server
   */
  async getServer(serverId: string): Promise<McpServer | null> {
    return this.api.getServer(serverId);
  }
  
  /**
   * Send a request to an MCP server
   */
  async sendRequest(
    serverId: string,
    method: string,
    params?: any
  ): Promise<string> {
    logger.debug('Sending MCP request', { serverId, method, params });
    return this.api.sendRequest(serverId, method, params);
  }
  
  /**
   * List available tools from an MCP server
   */
  async listTools(serverId: string): Promise<any> {
    const response = await this.api.listTools(serverId);
    return JSON.parse(response);
  }
  
  /**
   * Execute a tool on an MCP server
   */
  async executeTool(request: ToolExecutionRequest): Promise<any> {
    logger.debug('Executing MCP tool', { 
      serverId: request.server_id,
      toolName: request.tool_name 
    });
    const response = await this.api.executeTool(request);
    return JSON.parse(response);
  }
  
  /**
   * List available resources from an MCP server
   */
  async listResources(serverId: string): Promise<any> {
    const response = await this.api.listResources(serverId);
    return JSON.parse(response);
  }
  
  /**
   * Read a resource from an MCP server
   */
  async readResource(serverId: string, uri: string): Promise<any> {
    logger.debug('Reading MCP resource', { serverId, uri });
    const response = await this.api.readResource(serverId, uri);
    return JSON.parse(response);
  }
  
  /**
   * List available prompts from an MCP server
   */
  async listPrompts(serverId: string): Promise<any> {
    const response = await this.api.listPrompts(serverId);
    return JSON.parse(response);
  }
  
  /**
   * Get a prompt from an MCP server
   */
  async getPrompt(
    serverId: string,
    name: string,
    args: any
  ): Promise<any> {
    logger.debug('Getting MCP prompt', { serverId, name, args });
    const response = await this.api.getPrompt(serverId, name, args);
    return JSON.parse(response);
  }
  
  /**
   * Check if a server is healthy
   */
  async checkHealth(serverId: string): Promise<boolean> {
    try {
      const server = await this.getServer(serverId);
      return server?.status === 'Running';
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const mcpApi = new McpApi();