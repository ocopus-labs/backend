# GEMINI.md - AI-Powered Project Assistant Context

This file provides essential context for AI assistants to understand and effectively contribute to this project.

## Project Overview

This is a backend for a multi-tenant billing and business management application built with the **NestJS** framework. It uses a modular architecture, with clear separation between feature modules and shared libraries.

- **Core Framework:** [NestJS](https://nestjs.com/) (TypeScript)
- **Database ORM:** [Prisma](https://www.prisma.io/)
- **Database:** PostgreSQL
- **Authentication:** Handled by `@thallesp/nestjs-better-auth`.
- **Package Manager:** [pnpm](https://pnpm.io/)
- **Containerization:** Docker is used for deployment, with configuration in `docker-compose.yml` and `Dockerfile`.

### Architecture

The project follows a clean, modular structure documented in `docs/project-structure.md`.

- **`src/modules`**: Contains self-contained feature modules like `auth`, `business`, `mail`, `menu`, `order`, and `payment`. Each module has its own controller, service, and module definition.
- **`src/lib`**: Contains shared, reusable code that is not specific to any single NestJS module. This includes shared constants, decorators, guards, and business logic adapters.
- **`prisma`**: Contains the database schema (`schema.prisma`), migrations, and seeding scripts.

## Building and Running the Project

### Prerequisites

- Node.js
- pnpm
- Docker (optional, for containerized environment)

### Key Commands

The following commands are defined in `package.json` and should be run with `pnpm`:

- **Install dependencies:**
  ```bash
  pnpm install
  ```

- **Run in development mode (with hot-reload):**
  ```bash
  pnpm run start:dev
  ```
  The server will be available at `http://localhost:3000`.

- **Build for production:**
  ```bash
  pnpm run build
  ```

- **Run in production mode:**
  ```bash
  pnpm run start:prod
  ```

- **Run tests:**
  ```bash
  # Run unit tests
  pnpm run test

  # Run end-to-end (e2e) tests
  pnpm run test:e2e
  ```

- **Database commands:**
  ```bash
  # Apply database migrations
  pnpx prisma migrate dev

  # Generate Prisma client after schema changes
  pnpx prisma generate

  # Seed the database with initial data
  pnpm run seed
  ```

- **Run with Docker:**
  ```bash
  docker-compose up --build
  ```

## Development Conventions

- **Coding Style:** The project uses **Prettier** for automated code formatting and **ESLint** for linting.
  - Style rules are defined in `.prettierrc` (single quotes, trailing commas).
  - Linting rules are in `eslint.config.mjs`.
- **Formatting:** To format the code, run:
  ```bash
  pnpm run format
  ```
- **File Structure:** Adhere to the guidelines in `docs/project-structure.md` when adding new modules or shared utilities.
- **API Endpoints:** All API routes are prefixed with `/api`. This is configured in `src/main.ts`.
