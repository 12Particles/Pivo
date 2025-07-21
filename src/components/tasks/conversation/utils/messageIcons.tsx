import { 
  Bot, User, Settings, Brain, AlertCircle, Sparkles,
  Eye, Edit, Terminal, Search, Globe, Plus, CheckSquare, FileText
} from "lucide-react";
import { Message } from "../types";

export const getMessageIcon = (message: Message) => {
  const type = message.type;
  const toolName = message.metadata?.toolName;
  
  // Tool-specific icons
  if (type === "tool_use" && toolName) {
    if (toolName.includes("read") || toolName.includes("Read")) {
      return <Eye className="h-4 w-4 text-orange-600" />;
    }
    if (toolName.includes("write") || toolName.includes("Write") || toolName.includes("edit") || toolName.includes("Edit")) {
      return <Edit className="h-4 w-4 text-red-600" />;
    }
    if (toolName.includes("bash") || toolName.includes("Bash") || toolName.includes("terminal")) {
      return <Terminal className="h-4 w-4 text-yellow-600" />;
    }
    if (toolName.includes("search") || toolName.includes("Search") || toolName.includes("grep") || toolName.includes("Grep")) {
      return <Search className="h-4 w-4 text-indigo-600" />;
    }
    if (toolName.includes("web") || toolName.includes("Web")) {
      return <Globe className="h-4 w-4 text-cyan-600" />;
    }
    if (toolName.includes("create") || toolName.includes("Create")) {
      return <Plus className="h-4 w-4 text-teal-600" />;
    }
    if (toolName.includes("todo") || toolName.includes("Todo")) {
      return <CheckSquare className="h-4 w-4 text-purple-600" />;
    }
    return <FileText className="h-4 w-4 text-gray-600" />;
  }
  
  // Message type icons
  switch (type) {
    case "user":
      return <User className="h-4 w-4 text-blue-600" />;
    case "assistant":
      return <Bot className="h-4 w-4 text-green-600" />;
    case "system":
      return <Settings className="h-4 w-4 text-gray-600" />;
    case "thinking":
      return <Brain className="h-4 w-4 text-purple-600" />;
    case "error":
      return <AlertCircle className="h-4 w-4 text-red-600" />;
    default:
      return <Sparkles className="h-4 w-4 text-gray-600" />;
  }
};