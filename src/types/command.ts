export interface Command {
  name: string;
  description?: string;
  path: string;
  content?: string;
  type: 'claude' | 'custom'; // 可以扩展支持其他类型
}

export interface CommandSearchResult {
  commands: Command[];
  total: number;
}