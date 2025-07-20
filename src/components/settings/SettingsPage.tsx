import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings as SettingsIcon } from "lucide-react";
import { McpServerManager } from "@/components/mcp/McpServerManager";
import { GeneralSettings } from "./GeneralSettings";
import { McpConfigManager } from "./McpConfigManager";
import { GitLabSettings } from "./GitLabSettings";
import { useTranslation } from "react-i18next";

interface SettingsPageProps {
  onBack: () => void;
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const { t } = useTranslation();
  
  return (
    <div className="h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                <SettingsIcon className="h-5 w-5" />
                <h1 className="text-2xl font-bold">{t('settings.title')}</h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-6">
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-4 max-w-[800px]">
            <TabsTrigger value="general">{t('settings.generalSettings')}</TabsTrigger>
            <TabsTrigger value="gitlab">GitLab</TabsTrigger>
            <TabsTrigger value="mcp">{t('settings.mcpServers')}</TabsTrigger>
            <TabsTrigger value="mcp-config">{t('settings.mcpConfiguration')}</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <GeneralSettings />
          </TabsContent>

          <TabsContent value="gitlab" className="space-y-4">
            <GitLabSettings />
          </TabsContent>

          <TabsContent value="mcp" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>MCP Server Management</CardTitle>
                <CardDescription>
                  Manage and configure Model Context Protocol (MCP) servers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <McpServerManager />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mcp-config" className="space-y-4">
            <McpConfigManager />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}