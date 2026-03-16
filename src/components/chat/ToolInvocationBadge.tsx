"use client";

import { ToolInvocation } from "ai";
import { Loader2 } from "lucide-react";

interface ToolInvocationBadgeProps {
  toolInvocation: ToolInvocation;
}

function getFriendlyLabel(toolName: string, args: Record<string, unknown>): string {
  const path = args.path as string | undefined;
  const command = args.command as string | undefined;

  if (toolName === "str_replace_editor") {
    switch (command) {
      case "create":
        return `Creating ${path}`;
      case "str_replace":
        return `Editing ${path}`;
      case "insert":
        return `Editing ${path}`;
      case "view":
        return `Reading ${path}`;
      case "undo_edit":
        return `Undoing edit on ${path}`;
    }
  }

  if (toolName === "file_manager") {
    const newPath = args.new_path as string | undefined;
    switch (command) {
      case "rename":
        return `Renaming ${path} → ${newPath}`;
      case "delete":
        return `Deleting ${path}`;
    }
  }

  return toolName;
}

export function ToolInvocationBadge({ toolInvocation }: ToolInvocationBadgeProps) {
  const completed = toolInvocation.state === "result" && toolInvocation.result;
  const label = getFriendlyLabel(
    toolInvocation.toolName,
    toolInvocation.args as Record<string, unknown>
  );

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs font-mono border border-neutral-200">
      {completed ? (
        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
      ) : (
        <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
      )}
      <span className="text-neutral-700">{label}</span>
    </div>
  );
}
