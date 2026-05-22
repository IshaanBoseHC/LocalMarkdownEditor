# Local Markdown Editor

A local-first markdown editor inspired by Obsidian, built with Electron, React, TypeScript, and CodeMirror 6. Opens any folder of markdown files as a vault and provides a live preview editing experience where you type markdown but see the formatted output in real time.

## Features

### Live Preview Editing

The default editing mode hides markdown syntax and renders formatting inline, just like Obsidian's Live Preview. When your cursor moves onto a formatted element, the raw markdown is revealed for editing. When you move away, the syntax characters are hidden and the visual formatting is shown.

| What you type | What you see (cursor away) |
|---------------|---------------------------|
| `# Heading` | **Heading** rendered large, `#` hidden |
| `**bold text**` | **bold text**, stars hidden |
| `*italic*` | *italic*, stars hidden |
| `~~strikethrough~~` | ~~strikethrough~~, tildes hidden |
| `` `inline code` `` | `inline code`, backticks hidden |
| `[link text](url)` | link text (underlined, URL hidden) |
| `- list item` | Bullet item, dash replaced with dot |
| `- [ ] task` | Checkbox task item |
| `> blockquote` | Styled blockquote with left border |
| `---` | Visual horizontal rule |

### Three View Modes

- **Live Preview** (default) -- WYSIWYG-like editing with hidden syntax
- **Source** -- Raw markdown editing with syntax highlighting and line numbers
- **Reading** -- Fully rendered read-only preview

Cycle through modes with `Cmd+E` (macOS) / `Ctrl+E` (Windows/Linux).

### File Management

- **File tree sidebar** with collapsible folders and files sorted alphabetically (folders first)
- **Right-click context menu** for creating, renaming, and deleting files and folders
- **Delete to trash** -- deleted files are moved to the OS trash, not permanently removed
- **Resizable sidebar** -- drag the edge to resize between 180px and 500px

### Full-Text Search

- Toggle with `Cmd+Shift+F` / `Ctrl+Shift+F`
- Searches across all `.md` files in the vault
- Results grouped by file with line numbers and surrounding context
- Click a result to open the file

### Tags

- Automatically parses `#tag` patterns from file content
- Displays tags in a bar at the bottom of the sidebar
- Click a tag to filter the file tree to only files containing that tag

### Graph View

- Toggle with `Cmd+G` / `Ctrl+G` or the **Graph** toolbar button
- Visualizes relationships between all markdown files in the vault
- Detects three types of connections:
  - **Wiki links** (`[[filename]]`) -- direct references between notes
  - **Markdown links** (`[text](path.md)`) -- standard links to other `.md` files
  - **Shared tags** -- files that share the same `#tag` (capped at tags appearing in 20 or fewer files to avoid clutter)
- Force-directed layout powered by d3-force, rendered on `<canvas>` for performance
- Pan, zoom (scroll wheel), and drag nodes interactively
- Filter input in the toolbar to highlight nodes matching a name or tag
- Hover tooltips showing file name, connection count, and tags
- Click any node to open that file in Live Preview mode
- Color-coded legend distinguishing link types

### Recent Files & Empty State

- When no file is selected, the editor area shows a welcome screen with:
  - **Recent files** -- last 10 opened files with relative timestamps, click to reopen
  - **Keyboard shortcut grid** -- quick reference for the most useful shortcuts
- Recent files are persisted across sessions

### Auto-Save

Files are automatically saved 1 second after you stop typing. A blue dot appears next to the filename in the toolbar when there are unsaved changes. Press `Cmd+S` / `Ctrl+S` to save immediately.

### Vault Persistence

The app remembers your last opened vault and reopens it automatically on next launch. Select a different vault at any time via the folder picker.

## Keyboard Shortcuts

### Formatting

| Shortcut | Action |
|----------|--------|
| `Cmd+B` | Toggle **bold** |
| `Cmd+I` | Toggle *italic* |
| `Cmd+Shift+X` | Toggle ~~strikethrough~~ |
| `Cmd+Shift+K` | Toggle `inline code` |
| `Cmd+K` | Insert link |
| `Cmd+1` -- `Cmd+6` | Set heading level 1--6 |
| `Cmd+Shift+B` | Toggle blockquote |
| `Cmd+Shift+8` | Toggle bullet list |
| `Cmd+Shift+7` | Toggle ordered list |
| `Cmd+Shift+9` | Toggle task list |
| `Cmd+Shift+-` | Insert horizontal rule |

### Navigation & App

| Shortcut | Action |
|----------|--------|
| `Cmd+S` | Save current file |
| `Cmd+E` | Cycle view mode (Live Preview / Source / Reading) |
| `Cmd+G` | Toggle graph view |
| `Cmd+Shift+F` | Toggle search panel |
| `Cmd+Z` | Undo |
| `Cmd+Shift+Z` | Redo |
| `Cmd+F` | Find in current file (CodeMirror built-in) |

> On Windows/Linux, replace `Cmd` with `Ctrl`.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | [Electron](https://www.electronjs.org/) |
| Build system | [electron-vite](https://electron-vite.org/) + [Vite](https://vitejs.dev/) |
| UI framework | [React 19](https://react.dev/) + TypeScript |
| Editor | [CodeMirror 6](https://codemirror.net/) with markdown language support |
| Markdown preview | [react-markdown](https://github.com/remarkjs/react-markdown) + [remark-gfm](https://github.com/remarkjs/remark-gfm) |
| Graph physics | [d3-force](https://github.com/d3/d3-force) + [d3-selection](https://github.com/d3/d3-selection) |
| GFM extensions | Strikethrough, tables, task lists via [@lezer/markdown](https://github.com/lezer-parser/markdown) |

## Project Structure

```
src/
├── main/                          # Electron main process
│   ├── index.ts                   # App entry, BrowserWindow creation
│   ├── ipc.ts                     # IPC handler registration
│   ├── fileSystem.ts              # All Node.js filesystem operations
│   └── store.ts                   # Simple JSON config persistence
├── preload/
│   └── index.ts                   # Context bridge (secure IPC API)
├── renderer/                      # React app (renderer process)
│   ├── index.html
│   ├── main.tsx                   # React entry point
│   ├── App.tsx                    # Root layout and state wiring
│   ├── env.d.ts                   # window.api type declaration
│   ├── components/
│   │   ├── VaultPicker.tsx        # Startup vault selection screen
│   │   ├── TagsBar.tsx            # Tag display and filtering
│   │   ├── EmptyState.tsx         # Recent files + keyboard shortcut grid
│   │   ├── Sidebar/
│   │   │   ├── FileTree.tsx       # Collapsible file/folder tree
│   │   │   └── SearchPanel.tsx    # Full-text search UI
│   │   ├── Editor/
│   │   │   ├── MarkdownEditor.tsx # CodeMirror 6 wrapper
│   │   │   └── MarkdownPreview.tsx# react-markdown preview
│   │   └── Graph/
│   │       └── GraphView.tsx      # Canvas force-directed graph
│   ├── extensions/
│   │   ├── livePreview.ts         # CodeMirror live preview plugin
│   │   └── markdownCommands.ts    # Markdown formatting commands
│   ├── hooks/
│   │   ├── useFileTree.ts         # Load directory tree via IPC
│   │   ├── useFileContent.ts      # Read/write with debounced auto-save
│   │   ├── useSearch.ts           # Full-text vault search
│   │   └── useTags.ts             # Tag parsing and filtering
│   ├── context/
│   │   └── VaultContext.tsx       # Vault path and current file state
│   └── styles/
│       └── global.css             # Dark theme stylesheet
└── shared/
    └── types.ts                   # Shared types and IPC channel constants
```

## Architecture

The app follows Electron's recommended security model:

- **Main process** (`src/main/`) handles all filesystem operations and native dialogs. It never exposes Node.js APIs directly to the renderer.
- **Preload script** (`src/preload/`) uses `contextBridge` to expose a typed `window.api` object with specific IPC methods.
- **Renderer process** (`src/renderer/`) is a standard React app that communicates with the main process exclusively through the typed IPC API. It has no direct access to Node.js or the filesystem.

### IPC Channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `vault:open` | renderer &rarr; main | Open native folder picker |
| `vault:getLast` | renderer &rarr; main | Get last opened vault path |
| `fs:readTree` | renderer &rarr; main | Read directory tree recursively |
| `fs:readFile` | renderer &rarr; main | Read file content |
| `fs:writeFile` | renderer &rarr; main | Write file content |
| `fs:createFile` | renderer &rarr; main | Create new markdown file |
| `fs:createDir` | renderer &rarr; main | Create new directory |
| `fs:rename` | renderer &rarr; main | Rename file or directory |
| `fs:delete` | renderer &rarr; main | Move file/directory to trash |
| `search:query` | renderer &rarr; main | Full-text search across vault |
| `graph:build` | renderer &rarr; main | Build graph data (nodes + links) from vault |
| `recent:get` | renderer &rarr; main | Get list of recently opened files |
| `recent:add` | renderer &rarr; main | Record a file as recently opened |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- npm

### Install

```bash
git clone https://github.com/IshaanBoseHC/LocalMarkdownEditor.git
cd LocalMarkdownEditor
npm install
```

### Run

```bash
npm run dev
```

This builds the app and launches it. On first run, you'll see a startup screen -- click **Open Vault** to select a folder containing your markdown files.

### Build for Production

```bash
npm run build
```

Outputs the compiled app to the `out/` directory.

## Design Decisions

- **No database** -- all state comes directly from the filesystem. The app doesn't create any files inside your vault.
- **No vendor lock-in** -- works with any folder of `.md` files. Compatible with Obsidian, Logseq, or any other markdown tool's vault structure.
- **Dark theme only** -- Obsidian-style dark color scheme optimized for long editing sessions.
- **Single file view** -- one file open at a time (no tabs). Keeps the interface focused.
- **Trash, not delete** -- file deletion moves items to the OS trash via `shell.trashItem`, so nothing is permanently lost.
- **Local only** -- no network requests, no telemetry, no cloud sync. Your files stay on your machine.

## License

ISC
