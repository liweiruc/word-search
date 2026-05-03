# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A word-search game project. Currently in initial setup — no source files exist yet.

## Stack

- **Build tool**: Vite (^8.0.10)
- **Module system**: CommonJS (`"type": "commonjs"` in package.json)

## Commands

```bash
# Install dependencies
npm install

# Start dev server (once vite.config is in place)
npx vite

# Build for production
npx vite build
```

No test runner is configured yet (`npm test` exits with an error).

## Development Guidelines

- **Architecture**: Keep logic and view separated — game logic in dedicated JS modules, rendering/UI in separate files.
- **UI**: Clean and modern interface, optimized for iPad (touch-friendly, responsive layout targeting ~768–1024px).
- **Minimal scope**: Do not create files or features that were not explicitly requested.
- **Focused edits**: Avoid refactoring existing code unless necessary to complete the task.
