import { test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ToolInvocationBadge } from "../ToolInvocationBadge";
import type { ToolInvocation } from "ai";

afterEach(() => {
  cleanup();
});

function pending(toolName: string, args: Record<string, unknown>): ToolInvocation {
  return { toolCallId: "id", toolName, args, state: "call" } as ToolInvocation;
}

function completed(toolName: string, args: Record<string, unknown>): ToolInvocation {
  return { toolCallId: "id", toolName, args, state: "result", result: "Success" } as ToolInvocation;
}

test("str_replace_editor create shows Creating label", () => {
  render(<ToolInvocationBadge toolInvocation={completed("str_replace_editor", { command: "create", path: "/App.jsx" })} />);
  expect(screen.getByText("Creating /App.jsx")).toBeDefined();
});

test("str_replace_editor str_replace shows Editing label", () => {
  render(<ToolInvocationBadge toolInvocation={completed("str_replace_editor", { command: "str_replace", path: "/components/Card.tsx" })} />);
  expect(screen.getByText("Editing /components/Card.tsx")).toBeDefined();
});

test("str_replace_editor insert shows Editing label", () => {
  render(<ToolInvocationBadge toolInvocation={completed("str_replace_editor", { command: "insert", path: "/App.jsx" })} />);
  expect(screen.getByText("Editing /App.jsx")).toBeDefined();
});

test("str_replace_editor view shows Reading label", () => {
  render(<ToolInvocationBadge toolInvocation={completed("str_replace_editor", { command: "view", path: "/App.jsx" })} />);
  expect(screen.getByText("Reading /App.jsx")).toBeDefined();
});

test("str_replace_editor undo_edit shows Undoing edit label", () => {
  render(<ToolInvocationBadge toolInvocation={completed("str_replace_editor", { command: "undo_edit", path: "/App.jsx" })} />);
  expect(screen.getByText("Undoing edit on /App.jsx")).toBeDefined();
});

test("file_manager rename shows Renaming label", () => {
  render(<ToolInvocationBadge toolInvocation={completed("file_manager", { command: "rename", path: "/old.jsx", new_path: "/new.jsx" })} />);
  expect(screen.getByText("Renaming /old.jsx → /new.jsx")).toBeDefined();
});

test("file_manager delete shows Deleting label", () => {
  render(<ToolInvocationBadge toolInvocation={completed("file_manager", { command: "delete", path: "/App.jsx" })} />);
  expect(screen.getByText("Deleting /App.jsx")).toBeDefined();
});

test("unknown tool shows tool name as fallback", () => {
  render(<ToolInvocationBadge toolInvocation={completed("unknown_tool", { command: "something" })} />);
  expect(screen.getByText("unknown_tool")).toBeDefined();
});

test("pending state renders spinner", () => {
  const { container } = render(<ToolInvocationBadge toolInvocation={pending("str_replace_editor", { command: "create", path: "/App.jsx" })} />);
  expect(container.querySelector(".animate-spin")).toBeDefined();
});

test("completed state renders green dot", () => {
  const { container } = render(<ToolInvocationBadge toolInvocation={completed("str_replace_editor", { command: "create", path: "/App.jsx" })} />);
  expect(container.querySelector(".bg-emerald-500")).toBeDefined();
});
