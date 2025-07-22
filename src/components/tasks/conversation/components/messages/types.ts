import { Message } from "../../types";

export interface MessageComponentProps {
  message: Message;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isPending?: boolean;
}

export interface MessageHeaderProps {
  icon: React.ReactNode;
  title: string;
  timestamp: Date;
}