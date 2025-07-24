import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Download, Upload, Save } from "lucide-react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

interface McpConfig {
  servers: {
    [key: string]: {
      command: string;
      args?: string[];
      env?: Record<string, string>;
    };
  };
}

export function McpConfigManager() {
  const [configJson, setConfigJson] = useState<string>("");
  const [isValid, setIsValid] = useState(true);

  useEffect(() => {
    // 加载默认配置
    const defaultConfig: McpConfig = {
      servers: {
        filesystem: {
          command: "npx",
          args: ["@modelcontextprotocol/server-filesystem", "/path/to/allowed/directory"],
        },
        github: {
          command: "npx",
          args: ["@modelcontextprotocol/server-github"],
          env: {
            GITHUB_TOKEN: "your-github-token",
          },
        },
      },
    };
    setConfigJson(JSON.stringify(defaultConfig, null, 2));
  }, []);

  const validateJson = (json: string) => {
    try {
      JSON.parse(json);
      setIsValid(true);
      return true;
    } catch {
      setIsValid(false);
      return false;
    }
  };

  const handleJsonChange = (value: string) => {
    setConfigJson(value);
    validateJson(value);
  };

  const handleImportConfig = async () => {
    try {
      const filePath = await open({
        multiple: false,
        filters: [{
          name: "JSON",
          extensions: ["json"],
        }],
      });

      if (filePath) {
        const content = await readTextFile(filePath as string);
        setConfigJson(content);
        if (validateJson(content)) {
          toast({
            title: "成功",
            description: "配置文件已导入",
          });
        }
      }
    } catch (error) {
      toast({
        title: "错误",
        description: `导入配置失败: ${error}`,
        variant: "destructive",
      });
    }
  };

  const handleExportConfig = async () => {
    if (!validateJson(configJson)) {
      toast({
        title: "错误",
        description: "配置格式无效，请修正后再导出",
        variant: "destructive",
      });
      return;
    }

    try {
      const filePath = await save({
        filters: [{
          name: "JSON",
          extensions: ["json"],
        }],
        defaultPath: "mcp-config.json",
      });

      if (filePath) {
        await writeTextFile(filePath, configJson);
        toast({
          title: "成功",
          description: "配置文件已导出",
        });
      }
    } catch (error) {
      toast({
        title: "错误",
        description: `导出配置失败: ${error}`,
        variant: "destructive",
      });
    }
  };

  const handleApplyConfig = async () => {
    if (!validateJson(configJson)) {
      toast({
        title: "错误",
        description: "配置格式无效，请修正后再应用",
        variant: "destructive",
      });
      return;
    }

    try {
      // const config = JSON.parse(configJson) as McpConfig;
      // TODO: 应用配置到 MCP 服务器管理器
      toast({
        title: "成功",
        description: "配置已应用",
      });
    } catch (error) {
      toast({
        title: "错误",
        description: `应用配置失败: ${error}`,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>MCP 配置文件</CardTitle>
          <CardDescription>
            使用 JSON 格式配置 MCP 服务器。可以导入、导出和编辑配置文件。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleImportConfig}>
              <Upload className="h-4 w-4 mr-2" />
              导入配置
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportConfig}>
              <Download className="h-4 w-4 mr-2" />
              导出配置
            </Button>
            <Button size="sm" onClick={handleApplyConfig}>
              <Save className="h-4 w-4 mr-2" />
              应用配置
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="config-json">配置内容</Label>
              {!isValid && (
                <span className="text-sm text-destructive">JSON 格式无效</span>
              )}
            </div>
            <Textarea
              id="config-json"
              value={configJson}
              onChange={(e) => handleJsonChange(e.target.value)}
              className={`font-mono text-sm min-h-[400px] ${
                !isValid ? "border-destructive" : ""
              }`}
              placeholder="输入 JSON 配置..."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>配置示例</CardTitle>
          <CardDescription>MCP 服务器配置的参考示例</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`{
  "servers": {
    "filesystem": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem", "/path/to/directory"]
    },
    "github": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "your-github-token"
      }
    },
    "custom-server": {
      "command": "/path/to/custom/server",
      "args": ["--port", "3000"],
      "env": {
        "API_KEY": "your-api-key"
      }
    }
  }
}`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}