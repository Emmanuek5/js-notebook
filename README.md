### Code Notebook

A Bun + TypeScript powered programmable notebook runtime with a lightweight web API. It provides pluggable kernels (JavaScript and Shell), isolated per-notebook environments, basic file I/O, package installation via Bun, and performance/HTML output helpers.

---

### Table of contents
- Overview
- Features
- Requirements
- Getting started
- Run modes
- API reference
- Programmatic usage
- Project structure
- Tech stack
- Notes and troubleshooting

---

### Overview
Code Notebook lets you create and execute cells backed by different kernels. The default setup registers a JavaScript kernel (using `vm`) and a Shell kernel (executed via Bun). A small Express server exposes a JSON API under `/api` for managing cells, environment variables, files, and saving/loading notebook state.

### Features
- **JavaScript kernel**: Sandboxed execution, console capture, basic syntax checking (Acorn), and optional AI libs (`@tensorflow/tfjs-node`, `danfojs-node`) exposed via `require('node-kernel')` inside cells
- **Shell kernel**: Execute shell commands within the notebook’s working directory via Bun
- **Per-notebook environment**: File read/write helpers and environment variable management
- **Persistence**: Save and load notebook state from `my_notebook.json`
- **Web API**: Express-based API with security middleware (`helmet`, `compression`)
- **Performance metrics**: Collect CPU/memory/disk stats during cell execution using `systeminformation`

### Requirements
- **Bun**: v1.1.20 or newer. Install from the Bun website: [Bun official site](https://bun.sh)

### Getting started
- **Install dependencies**:
```bash
bun install
```
- **Build (optional for dev, recommended for CI)**:
```bash
bun run build
```

### Run modes
- **Web API server (recommended)**:
```bash
bun run serve
```
Visit `http://localhost:3000`. Static assets are served from `src/web/public/` if present. Configure the port via `PORT`.

- **Minimal sample app (dev/demo)**:
```bash
bun run start
```
This also spins up an Express app and demonstrates basic notebook usage.

### API reference (base path: `/api`)
- **GET `/notebook`**: Returns the current notebook state
- **GET `/envs`**: Returns environment variables
- **POST `/envs`**: Merge/update environment variables (JSON body)
- **GET `/packages`**: Lists packages recorded as installed in the notebook
- **POST `/packages`**: Install a package into the notebook environment (JSON: `{ "packages": "lodash" }`)
- **GET `/files`**: Lists files in the notebook working directory
- **POST `/file`**: Save a file into the notebook directory (JSON: `{ filename, content }`)
- **PUT `/cell`**: Update an existing cell (JSON: `{ cellId, content }`)
- **POST `/cell`**: Create a cell; returns `{ cellId }` (JSON: `{ kernelName, content }`)
- **POST `/execute`**: Execute a cell; returns outputs (JSON: `{ cellId }`)
- **POST `/save`**: Persist notebook to `my_notebook.json`

Notes:
- The JavaScript kernel is registered as `javascript`; the Shell kernel as `shell`.
- For package installation, the server currently expects a single package string.

### Programmatic usage
```ts
import { Notebook } from './src/notebook';
import { JavaScriptKernel } from './src/kernels/javascript';
import { ShellKernel } from './src/kernels/shell';

async function main() {
  const notebook = new Notebook();
  await notebook.initialize();

  notebook.registerKernel('javascript', new JavaScriptKernel());
  notebook.registerKernel('shell', new ShellKernel());

  notebook.addEnvs({ SAMPLE_FLAG: '1' });

  const cellId = await notebook.createCell('javascript', `
    const { tf } = require('node-kernel');
    console.log('hello from JS cell');
    // return any value; console output is also captured
    'done';
  `);

  const outputs = await notebook.executeCell(cellId);
  console.log(outputs);

  await notebook.saveNotebook('my_notebook.json');
}

main().catch(console.error);
```

### Project structure
```text
src/
  index.ts                  # Minimal demo server
  notebook.ts               # Core notebook class
  cell.ts                   # Cell model and output handling
  notebook-environment.ts   # Per-notebook working dir, env vars, HTML outputs
  kernels/
    javascript.ts           # JavaScript kernel (vm + acorn)
    shell.ts                # Shell kernel (Bun.spawn)
  web/
    server.ts               # Production-oriented Express server
    routes/notebookRoutes.ts
    controllers/notebookController.ts
    services/notebookService.ts
  utils/                    # (placeholders)
  visualizations/           # (placeholders)
```

### Tech stack
- **Runtime/tooling**: Bun
- **Language**: TypeScript
- **Server**: Express with `helmet` and `compression`
- **Execution**: `vm` + `acorn` for JS cell execution and syntax checking
- **AI/Data**: `@tensorflow/tfjs-node`, `danfojs-node` (available within JS cells via `require('node-kernel')`)
- **Metrics**: `systeminformation` for performance metrics

### Notes and troubleshooting
- **Security**: Shell kernel runs commands inside the notebook directory and inherits PATH with `node_modules/.bin`. Avoid exposing this API to untrusted users.
- **Bun version**: If Bun is missing or outdated, install/upgrade from the Bun website: [Bun official site](https://bun.sh)
- **Port conflicts**: If 3000 is busy, set `PORT=xxxx` before running `bun run serve`.

---

This project was bootstrapped with `bun init`. Bun is a fast all-in-one JavaScript runtime: [Bun official site](https://bun.sh)
