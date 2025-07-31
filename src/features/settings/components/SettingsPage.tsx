import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings as SettingsIcon, Monitor, GitBranch, Server } from "lucide-react";
import { cn } from "@/lib/utils";
import { McpServerManager } from "@/features/mcp/components/McpServerManager";
import { GeneralSettings } from "./GeneralSettings";
import { GitServicesSettings } from "./GitServicesSettings";
import { useTranslation } from "react-i18next";

interface SettingsPageProps {
  onBack: () => void;
  initialCategory?: string;
}

type SettingsCategory = "general" | "git-services" | "mcp";

interface CategoryItem {
  id: SettingsCategory;
  label: string;
  icon: React.ReactNode;
}

export function SettingsPage({ onBack, initialCategory }: SettingsPageProps) {
  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState<SettingsCategory>(
    (initialCategory as SettingsCategory) || "general"
  );

  const categories: CategoryItem[] = [
    {
      id: "general",
      label: t("settings.categories.general"),
      icon: <Monitor className="h-4 w-4" />
    },
    {
      id: "git-services",
      label: t("settings.categories.gitServices"),
      icon: <GitBranch className="h-4 w-4" />
    },
    {
      id: "mcp",
      label: t("settings.categories.mcp"),
      icon: <Server className="h-4 w-4" />
    }
  ];

  const renderContent = () => {
    switch (selectedCategory) {
      case "general":
        return <GeneralSettings />;
      case "git-services":
        return <GitServicesSettings />;
      case "mcp":
        return <McpServerManager />;
      default:
        return null;
    }
  };

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b flex-shrink-0">
        <div className="p-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5" />
              <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 border-r bg-muted/10 p-4 overflow-y-auto">
          <nav className="space-y-1">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  selectedCategory === category.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {category.icon}
                {category.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-6">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}