# CLAUDE.md - Mini POS System Guide

## Build Commands
- Frontend Dev: `npm run dev`
- Backend Dev: `cd backend && npm run dev`
- Frontend Build: `npm run build`
- Backend Build: `cd backend && npm run build`
- Frontend Lint: `npm run lint`
- Database Reset: `cd backend && npx prisma migrate reset`
- Database Seed: `cd backend && npm run seed`

## Code Style Guidelines
- **Imports:** Group imports by type (React, libraries, local components, types)
- **Types:** Use strict TypeScript typing with interfaces for complex objects
- **Naming:** PascalCase for components, camelCase for variables/functions
- **Error Handling:** Use try/catch blocks with specific error messages
- **Components:** Create reusable components in dedicated folders
- **Context:** Use React Context for state that needs to be shared
- **Database:** IndexedDB for local storage with sync capabilities
- **Offline-First:** Always handle both online and offline states
- **Comments:** Use comments for complex logic, not obvious operations
- **Styling:** Use TailwindCSS utility classes for styling