# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Initial setup (install deps, generate Prisma client, run migrations)
npm run setup

# Development server (uses Turbopack + node-compat shim)
npm run dev

# Build for production
npm run build

# Run all tests
npm test

# Run a single test file
npx vitest run src/components/chat/__tests__/ChatInterface.test.tsx

# Lint
npm run lint

# Reset the database
npm run db:reset

# After schema changes: regenerate Prisma client
npx prisma generate

# After schema changes: create and apply a migration
npx prisma migrate dev
```

The `NODE_OPTIONS='--require ./node-compat.cjs'` flag is automatically injected by the npm scripts — it provides Node.js built-in compatibility shims required by Prisma under Next.js.

## Architecture Overview

UIGen is a chat-driven React component generator with live preview. Users describe components in a chat panel; the AI writes/edits files in a virtual file system; the right panel renders them live in an iframe.

### Request Flow

1. User sends a message → `ChatProvider` (`src/lib/contexts/chat-context.tsx`) calls `/api/chat` via the Vercel AI SDK `useChat` hook, passing the serialized virtual file system.
2. The API route (`src/app/api/chat/route.ts`) reconstructs a `VirtualFileSystem`, streams Claude responses with two registered tools: `str_replace_editor` and `file_manager`.
3. Tool calls arrive on the client; `FileSystemContext.handleToolCall` applies them to the in-memory VFS, triggering `refreshTrigger` state updates.
4. `PreviewFrame` (`src/components/preview/PreviewFrame.tsx`) watches `refreshTrigger`, transforms all VFS files with Babel standalone into blob URLs, injects an import map, and renders the result in a sandboxed iframe.

### Virtual File System

`VirtualFileSystem` (`src/lib/file-system.ts`) is a pure in-memory tree. It never touches disk. The AI-facing tools (`str_replace_editor`, `file_manager`) operate on it server-side, and the serialized form is round-tripped as JSON in every chat request body. Authenticated users' file systems are persisted to SQLite via `prisma.project.update` in the `onFinish` callback.

### Preview / Transform Pipeline

`src/lib/transform/jsx-transformer.ts` handles the browser-side compilation:
- `transformJSX` uses `@babel/standalone` to compile JSX/TSX to JS.
- `createImportMap` builds an ES module import map: local files become blob URLs; third-party imports are resolved from `esm.sh`; missing local imports get stub placeholder modules.
- `createPreviewHTML` generates the full iframe HTML with Tailwind CDN, error boundaries, and the dynamic `import()` entry point (`/App.jsx` is always the root).

### AI Provider

`src/lib/provider.ts` exports `getLanguageModel()`. When `ANTHROPIC_API_KEY` is absent, it returns `MockLanguageModel` (a deterministic multi-step mock that creates counter/form/card components). When the key is present, it returns `anthropic("claude-haiku-4-5")` via `@ai-sdk/anthropic`.

The system prompt (`src/lib/prompts/generation.tsx`) instructs the model to always create `/App.jsx` as the entry point and use `@/` import aliases for all local files.

### Authentication

JWT-based sessions via `jose`, stored in an httpOnly cookie (`auth-token`). `src/lib/auth.ts` is `server-only`. The middleware (`src/middleware.ts`) protects `/api/projects` and `/api/filesystem` routes. Anonymous users can use the app without signing in; their work is tracked in `src/lib/anon-work-tracker.ts` and offered to save on sign-up.

### Database

Prisma + SQLite (`prisma/dev.db`). The generated client is output to `src/generated/prisma/`. Two models: `User` (email/password) and `Project` (stores messages and file system as JSON strings). The `userId` on `Project` is nullable — anonymous projects have no owner.

### Context Providers

`FileSystemProvider` wraps the VFS instance and exposes file operations + `handleToolCall`. `ChatProvider` (nested inside) manages the AI chat state and wires incoming tool calls to `handleToolCall`. Both are mounted in `MainContent` (`src/app/main-content.tsx`), which also owns the Preview/Code tab state and the resizable panel layout.

### Testing

Vitest with jsdom and `@testing-library/react`. Tests live in `__tests__` subdirectories next to the code they test. The vitest config (`vitest.config.mts`) uses `vite-tsconfig-paths` to resolve the `@/` alias.
