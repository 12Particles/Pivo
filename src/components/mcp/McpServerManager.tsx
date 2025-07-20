import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { mcpApi } from "@/lib/api";
import { McpServer, McpServerStatus } from "@/types";
import { listen } from "@tauri-apps/api/event";
import { 
  Server, 
  Plus, 
  Play, 
  Square, 
  RefreshCw,
  Wrench,
  FileText,
  MessageSquare
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function McpServerManager() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingServer, setIsAddingServer] = useState(false);
  const [newServer, setNewServer] = useState({
    name: "",
    command: "",
    args: "",
    env: "",
  });

  useEffect(() => {
    loadServers();
    
    // Listen for server status updates
    const unlistenStatus = listen<McpServer>("mcp-server-status", (event) => {
      updateServerStatus(event.payload);
    });

    return () => {
      unlistenStatus.then((fn) => fn());
    };
  }, []);

  const loadServers = async () => {
    try {
      setIsLoading(true);
      const serverList = await mcpApi.listServers();
      setServers(serverList);
    } catch (error) {
      console.error("Failed to load servers:", error);
      toast({
        title: "错误",
        description: "无法加载 MCP 服务器列表",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateServerStatus = (updatedServer: McpServer) => {
    setServers((prev) =>
      prev.map((server) =>
        server.id === updatedServer.id ? updatedServer : server
      )
    );
  };

  const addServer = async () => {
    try {
      const args = newServer.args
        .split(" ")
        .map((arg) => arg.trim())
        .filter((arg) => arg.length > 0);
      
      const env: Record<string, string> = {};
      if (newServer.env) {
        newServer.env.split(",").forEach((pair) => {
          const [key, value] = pair.split("=").map((s) => s.trim());
          if (key && value) {
            env[key] = value;
          }
        });
      }

      await mcpApi.registerServer(
        newServer.name,
        newServer.command,
        args,
        env
      );

      toast({
        title: "成功",
        description: "MCP 服务器已注册",
      });

      setNewServer({ name: "", command: "", args: "", env: "" });
      setIsAddingServer(false);
      await loadServers();
    } catch (error) {
      console.error("Failed to add server:", error);
      toast({
        title: "错误",
        description: `注册服务器失败: ${error}`,
        variant: "destructive",
      });
    }
  };

  const startServer = async (serverId: string) => {
    try {
      await mcpApi.startServer(serverId);
      toast({
        title: "成功",
        description: "服务器启动中...",
      });
    } catch (error) {
      console.error("Failed to start server:", error);
      toast({
        title: "错误",
        description: `启动服务器失败: ${error}`,
        variant: "destructive",
      });
    }
  };

  const stopServer = async (serverId: string) => {
    try {
      await mcpApi.stopServer(serverId);
      toast({
        title: "成功",
        description: "服务器已停止",
      });
    } catch (error) {
      console.error("Failed to stop server:", error);
      toast({
        title: "错误",
        description: `停止服务器失败: ${error}`,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: McpServerStatus) => {
    switch (status) {
      case McpServerStatus.Running:
        return <Badge className="bg-green-500">运行中</Badge>;
      case McpServerStatus.Starting:
        return <Badge className="bg-yellow-500">启动中</Badge>;
      case McpServerStatus.Stopped:
        return <Badge variant="secondary">已停止</Badge>;
      case McpServerStatus.Error:
        return <Badge variant="destructive">错误</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            加载中...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            MCP 服务器
          </div>
          <Dialog open={isAddingServer} onOpenChange={setIsAddingServer}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                添加服务器
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>添加 MCP 服务器</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>名称</Label>
                  <Input
                    value={newServer.name}
                    onChange={(e) =>
                      setNewServer({ ...newServer, name: e.target.value })
                    }
                    placeholder="例如: filesystem"
                  />
                </div>
                <div>
                  <Label>命令</Label>
                  <Input
                    value={newServer.command}
                    onChange={(e) =>
                      setNewServer({ ...newServer, command: e.target.value })
                    }
                    placeholder="例如: npx"
                  />
                </div>
                <div>
                  <Label>参数 (空格分隔)</Label>
                  <Input
                    value={newServer.args}
                    onChange={(e) =>
                      setNewServer({ ...newServer, args: e.target.value })
                    }
                    placeholder="例如: @modelcontextprotocol/server-filesystem /path/to/dir"
                  />
                </div>
                <div>
                  <Label>环境变量 (可选, KEY=VALUE,KEY2=VALUE2)</Label>
                  <Input
                    value={newServer.env}
                    onChange={(e) =>
                      setNewServer({ ...newServer, env: e.target.value })
                    }
                    placeholder="例如: API_KEY=abc123,DEBUG=true"
                  />
                </div>
                <Button onClick={addServer} className="w-full">
                  添加服务器
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="space-y-3">
            {servers.map((server) => (
              <div
                key={server.id}
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4" />
                    <span className="font-medium">{server.name}</span>
                    {getStatusBadge(server.status)}
                  </div>
                  <div className="flex gap-2">
                    {server.status === McpServerStatus.Stopped ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startServer(server.id)}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    ) : server.status === McpServerStatus.Running ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => stopServer(server.id)}
                      >
                        <Square className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  <code>{server.command} {server.args.join(" ")}</code>
                </div>

                {server.status === McpServerStatus.Running && (
                  <div className="flex gap-2 text-xs">
                    {server.capabilities.tools && (
                      <Badge variant="outline" className="text-xs">
                        <Wrench className="h-3 w-3 mr-1" />
                        工具
                      </Badge>
                    )}
                    {server.capabilities.resources && (
                      <Badge variant="outline" className="text-xs">
                        <FileText className="h-3 w-3 mr-1" />
                        资源
                      </Badge>
                    )}
                    {server.capabilities.prompts && (
                      <Badge variant="outline" className="text-xs">
                        <MessageSquare className="h-3 w-3 mr-1" />
                        提示
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            ))}

            {servers.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                暂无 MCP 服务器
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}