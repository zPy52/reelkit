# Vidio — Walkthrough & Commands

## Codebase walkthrough

**Vidio** is a TypeScript SDK for video editing. It is published as an npm package that consumers install as a dependency and use programmatically (no CLI bins). The SDK builds to ESM (and optionally CJS) and exposes a public API for composing, cutting, and transforming video workflows in TypeScript/JavaScript.

### Layout

| Path | Purpose |
|------|--------|
| `src/index.ts` | Main entrypoint: re-exports public API (editor, timeline, effects, export, etc.). |
| `src/editor/` | Core editor: project definition, timeline model, clip/track types. |
| `src/timeline/` | Timeline logic: segments, in/out points, track management. |
| `src/effects/` | Effects and transitions: filters, transforms, optional plugins. |
| `src/export/` | Export pipeline: render settings, format options, optional backend adapters (FFmpeg, etc.). |
| `src/types/` | Shared types and interfaces used across the SDK. |
| `tsup.config.ts` | Build: ESM (and optionally CJS) from `src/index.ts` → `dist/`. `package.json` has `"files": ["dist"]` so only `dist/` is published. |

### Build & publish surface

- **Entry:** `src/index.ts` (tsup).
- **Output:** `dist/` (ESM, source maps; CJS if configured). Only `dist/` is published via `"files": ["dist"]`.
- **Consumption:** Library only. No `bin` entries. `prepublishOnly` runs `npm run build`.

---

## 1. Publish the package

From the project root:

```bash
# Install dependencies (if not already)
npm install

# Build (generates dist/; also runs automatically before publish)
npm run build

# Log in to npm (one-time per machine; requires npm account)
npm login

# Bump version if desired (optional)
npm version patch
# or: npm version minor
# or: npm version major

# Publish to npm (prepublishOnly will run build again)
npm publish
```

To publish a pre-release (e.g. beta):

```bash
npm version prerelease --preid=beta
npm publish --tag beta
```

---

## 2. Install and use (as a dependency)

### Install (in your app)

```bash
npm install vidio
# or
yarn add vidio
# or
pnpm add vidio
```

### Use in code

```ts
import { createEditor, addClip, exportTimeline } from 'vidio';

const editor = createEditor();
addClip(editor, { path: './intro.mp4', in: 0, out: 5 });
const result = await exportTimeline(editor, { format: 'mp4' });
```

(Exact API names and options depend on the implemented public surface; adjust imports and calls to match the real API.)

### Install a specific version

```bash
npm install vidio@latest
# or
npm install vidio@1.0.0
```

---

## 3. Development

- **Build:** `npm run build`
- **Dev/watch:** Add a `dev` script (e.g. `tsup --watch`) if desired.
- **Types:** TypeScript declarations are emitted with the build; consumers get full IntelliSense from the published package.
