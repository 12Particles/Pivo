import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { mcpApi } from "@/services/api";
import { McpServer, McpServerStatus } from "@/types";
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
  }, []);

  const loadServers = async () => {
    try {
      setIsLoading(true);
      const serverList = await mcpApi.listServers();
      setServers(serverList);
    } catch (error) {
      console.error('Failed to load MCP servers:', error);
      toast({
        title: "Error",
        description: "Failed to load MCP servers",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddServer = async () => {
    try {
      const args = newServer.args
        .split(" ")
        .map((arg) => arg.trim())
        .filter((arg) => arg.length > 0);

      const envVars: Record<string, string> = {};
      if (newServer.env) {
        newServer.env.split(",").forEach((pair) => {
          const [key, value] = pair.split("=").map((s) => s.trim());
          if (key && value) {
            envVars[key] = value;
          }
        });
      }

      await mcpApi.register({
        name: newServer.name,
        command: newServer.command,
        args,
        env: envVars,
      });

      await loadServers();
      setIsAddingServer(false);
      setNewServer({ name: "", command: "", args: "", env: "" });
      
      toast({
        title: "Success",
        description: "MCP server added successfully",
      });
    } catch (error) {
      console.error("Failed to add MCP server:", error);
      toast({
        title: "Error",
        description: "Failed to add MCP server",
        variant: "destructive",
      });
    }
  };

  const handleStartServer = async (id: string) => {
    try {
      await mcpApi.startServer(id);
      await loadServers();
      toast({
        title: "Success",
        description: "MCP server started",
      });
    } catch (error) {
      console.error("Failed to start MCP server:", error);
      toast({
        title: "Error",
        description: "Failed to start MCP server",
        variant: "destructive",
      });
    }
  };

  const handleStopServer = async (id: string) => {
    try {
      await mcpApi.stopServer(id);
      await loadServers();
      toast({
        title: "Success",
        description: "MCP server stopped",
      });
    } catch (error) {
      console.error("Failed to stop MCP server:", error);
      toast({
        title: "Error",
        description: "Failed to stop MCP server",
        variant: "destructive",
      });
    }
  };

  const getStatusBadgeVariant = (status: McpServerStatus): "default" | "destructive" | "outline" | "secondary" => {
    switch (status) {
      case "Running":
        return "default";
      case "Starting":
        return "outline";
      case "Stopped":
        return "secondary";
      case "Error":
        return "destructive";
      default:
        return "secondary";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">MCP Servers</h3>
        <Dialog open={isAddingServer} onOpenChange={setIsAddingServer}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Server
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle>Add MCP Server</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={newServer.name}
                  onChange={(e) =>
                    setNewServer({ ...newServer, name: e.target.value })
                  }
                  placeholder="My MCP Server"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="command">Command</Label>
                <Input
                  id="command"
                  value={newServer.command}
                  onChange={(e) =>
                    setNewServer({ ...newServer, command: e.target.value })
                  }
                  placeholder="node"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="args">Arguments (space-separated)</Label>
                <Input
                  id="args"
                  value={newServer.args}
                  onChange={(e) =>
                    setNewServer({ ...newServer, args: e.target.value })
                  }
                  placeholder="server.js --port 3000"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="env">
                  Environment Variables (comma-separated KEY=VALUE pairs)
                </Label>
                <Input
                  id="env"
                  value={newServer.env}
                  onChange={(e) =>
                    setNewServer({ ...newServer, env: e.target.value })
                  }
                  placeholder="NODE_ENV=production,PORT=3000"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setIsAddingServer(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddServer}
                disabled={!newServer.name || !newServer.command}
              >
                Add Server
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <ScrollArea className="h-[400px]">
        <div className="space-y-3">
          {servers.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Server className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">
                  No MCP servers configured
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setIsAddingServer(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Server
                </Button>
              </CardContent>
            </Card>
          ) : (
            servers.map((server) => (
              <Card key={server.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{server.name}</CardTitle>
                    <Badge variant={getStatusBadgeVariant(server.status)}>
                      {server.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">Command:</span>{" "}
                      {server.command} {server.args.join(" ")}
                    </div>

                    {server.capabilities && (
                      <div className="flex gap-2">
                        {server.capabilities.tools && (
                          <Badge variant="outline">
                            <Wrench className="h-3 w-3 mr-1" />
                            {server.capabilities.tools} tools
                          </Badge>
                        )}
                        {server.capabilities.resources && (
                          <Badge variant="outline">
                            <FileText className="h-3 w-3 mr-1" />
                            {server.capabilities.resources} resources
                          </Badge>
                        )}
                        {server.capabilities.prompts && (
                          <Badge variant="outline">
                            <MessageSquare className="h-3 w-3 mr-1" />
                            {server.capabilities.prompts} prompts
                          </Badge>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2">
                      {server.status === "Stopped" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStartServer(server.id)}
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Start
                        </Button>
                      ) : server.status === "Running" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStopServer(server.id)}
                        >
                          <Square className="h-4 w-4 mr-2" />
                          Stop
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}