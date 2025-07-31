import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GitHubSettings } from "./GitHubSettings";
import { GitLabSettings } from "./GitLabSettings";
import { useTranslation } from "react-i18next";

export function GitServicesSettings() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("github");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          {t("settings.categories.gitServices")}
        </h2>
        <p className="text-muted-foreground">
          {t("settings.gitServices.description")}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="github">GitHub</TabsTrigger>
          <TabsTrigger value="gitlab">GitLab</TabsTrigger>
        </TabsList>

        <TabsContent value="github" className="mt-6">
          <GitHubSettings />
        </TabsContent>

        <TabsContent value="gitlab" className="mt-6">
          <GitLabSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}