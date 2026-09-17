/**
 * Aer CLI - Connects to daemon process via IPC for runtime management.
 * Does NOT create Runtime instances directly.
 */

import { promises as fs } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, resolve, relative } from 'node:path';
import { createInterface } from 'node:readline';
import { Command } from 'commander';

const execFileAsync = promisify(execFile);
import { startDaemon, stopDaemon, restartDaemon, isRunning } from './daemon.js';
import { IpcClient } from './ipc-client.js';
import { IPCCommand } from '@aer/runtime-lib';

const program = new Command();

program
  .name('aer')
  .description('Aer Runtime CLI')
  .version('0.1.0');

// Helper: create and connect an IPC client
async function getIpcClient(): Promise<IpcClient> {
  const client = new IpcClient();
  await client.connect();
  return client;
}

type WorkspaceMode = 'read-only' | 'read-write';
type WorkspaceTool = 'list' | 'read' | 'search' | 'execute' | 'apply';

// Helper: interactive confirmation for read-write (destructive-adjacent) operations.
function confirmAction(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise<boolean>((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      resolve(normalized === 'yes' || normalized === 'y');
    });
  });
}

// ---- daemon management commands ----

program
  .command('start')
  .description('Start the runtime daemon process')
  .option('-l, --log-level <level>', 'Log level', 'info')
  .option('-e, --environment <env>', 'Environment', 'development')
  .option('--verbose', 'Enable verbose logging')
  .action(async (options) => {
    try {
      console.log('Starting Aer daemon...');
      const args: string[] = [];
      if (options.verbose || options.logLevel === 'debug') args.push('--verbose');
      if (options.environment) args.push('--environment', options.environment);
      await startDaemon({ args });
      console.log('Daemon started.');
    } catch (error) {
      console.error('Failed to start daemon:', error);
      process.exit(1);
    }
  });

program
  .command('stop')
  .description('Stop the runtime daemon process')
  .action(async () => {
    try {
      console.log('Stopping Aer daemon...');
      await stopDaemon();
      console.log('Daemon stopped.');
    } catch (error) {
      console.error('Failed to stop daemon:', error);
      process.exit(1);
    }
  });

program
  .command('restart')
  .description('Restart the runtime daemon process')
  .action(async () => {
    try {
      console.log('Restarting Aer daemon...');
      await restartDaemon();
      console.log('Daemon restarted.');
    } catch (error) {
      console.error('Failed to restart daemon:', error);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show daemon and runtime status via IPC')
  .action(async () => {
    if (!isRunning()) {
      console.log('Daemon running: No');
      return;
    }
    const client = await getIpcClient();
    try {
      const resp = await client.call(IPCCommand.RuntimeStatus);
      if (resp.success && resp.data) {
        const data = resp.data as { state: string };
        console.log(`Daemon running: Yes`);
        console.log(`Runtime state: ${data.state}`);
      } else {
        console.log('Daemon running: Yes (runtime query failed)');
      }
    } catch (error) {
      console.log('Daemon running: Yes (but IPC connection failed)');
    } finally {
      client.disconnect();
    }
  });

// ---- workflow placeholder commands ----

program
  .command('workflows:list')
  .description('List all running workflows')
  .action(() => {
    if (!isRunning()) {
      console.log('Daemon is not running. Start it first.');
      return;
    }
    console.log('No workflows currently running');
  });

program
  .command('workflows:start')
  .description('Start a new workflow')
  .argument('<workflow-type>', 'Workflow type')
  .action((workflowType) => {
    if (!isRunning()) {
      console.log('Daemon is not running. Start it first.');
      return;
    }
    console.log(`Requested workflow: ${workflowType}`);
  });

program
  .command('config:list')
  .description('List configuration values via IPC')
  .action(async () => {
    if (!isRunning()) {
      console.log('Daemon is not running. Start it first.');
      return;
    }
    const client = await getIpcClient();
    try {
      const resp = await client.call(IPCCommand.ConfigGet);
      if (resp.success && resp.data) {
        const config = resp.data as Record<string, unknown>;
        console.log('Configuration:');
        console.log(`- Environment: ${config.environment || 'unknown'}`);
        console.log(`- Log Level: ${config.logLevel || 'unknown'}`);
      } else {
        console.log('Failed to retrieve configuration.');
      }
    } catch (error) {
      console.error('IPC error:', error);
    } finally {
      client.disconnect();
    }
  });

program
  .command('ask')
  .description('Ask the Runtime a one-shot question')
  .argument('<prompt>', 'Question or instruction for the Runtime')
  .option('-m, --model <model>', 'Model identifier')
  .action(async (prompt: string, options: { model?: string }) => {
    if (!isRunning()) {
      console.error('Daemon is not running. Start it first.');
      process.exitCode = 1;
      return;
    }
    const client = await getIpcClient();
    try {
      const resp = await client.call(IPCCommand.Ask, { prompt, modelId: options.model });
      if (!resp.success || !resp.data) {
        console.error(resp.error?.message ?? 'Ask failed.');
        process.exitCode = 1;
        return;
      }
      const data = resp.data as { content: string };
      console.log(data.content);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : String(error);
      console.error(`Ask failed: ${message}`);
      process.exitCode = 1;
    } finally {
      client.disconnect();
    }
  });

program
  .command('chat')
  .description('Start an interactive conversation with the Runtime')
  .argument('[initial-prompt]', 'Optional first message')
  .option('-m, --model <model>', 'Model identifier')
  .action(async (initialPrompt: string | undefined, options: { model?: string }) => {
    if (!isRunning()) {
      console.error('Daemon is not running. Start it first.');
      process.exitCode = 1;
      return;
    }

    const client = await getIpcClient();
    const history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    const ask = async (prompt: string): Promise<void> => {
      const resp = await client.call(IPCCommand.Ask, {
        prompt,
        modelId: options.model,
        history,
      });
      if (!resp.success || !resp.data) throw new Error(resp.error?.message ?? 'Chat request failed.');
      const content = (resp.data as { content: string }).content;
      history.push({ role: 'user', content: prompt }, { role: 'assistant', content });
      console.log(`assistant> ${content}`);
    };

    try {
      console.log('Chat started. Press Ctrl+C or send EOF to exit.');
      if (initialPrompt) await ask(initialPrompt);
      const input = createInterface({ input: process.stdin, output: process.stdout, prompt: 'you> ' });
      input.prompt();
      for await (const line of input) {
        const prompt = line.trim();
        if (prompt) await ask(prompt);
        input.prompt();
      }
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : String(error);
      console.error(`Chat failed: ${message}`);
      process.exitCode = 1;
    } finally {
      client.disconnect();
    }
  });

program
  .command('workspace:read')
  .description('Read a file from an explicitly authorized workspace')
  .argument('<root>', 'Absolute workspace root')
  .argument('<path>', 'Relative file path')
  .action(async (root: string, filePath: string) => {
    if (!isRunning()) {
      console.error('Daemon is not running. Start it first.');
      process.exitCode = 1;
      return;
    }
    const client = await getIpcClient();
    try {
      const resp = await client.call(IPCCommand.WorkspaceRead, {
        rootPath: root,
        relativePath: filePath,
        mode: 'read-only',
      });
      if (!resp.success || !resp.data) {
        console.error(resp.error?.message ?? 'Workspace read failed.');
        process.exitCode = 1;
        return;
      }
      console.log((resp.data as { content: string }).content);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : String(error);
      console.error(`Workspace read failed: ${message}`);
      process.exitCode = 1;
    } finally {
      client.disconnect();
    }
  });

program
  .command('workspace:list')
  .description('List entries in an explicitly authorized workspace')
  .argument('<root>', 'Absolute workspace root')
  .argument('[path]', 'Relative directory path', '.')
  .action(async (root: string, directoryPath: string) => {
    if (!isRunning()) { console.error('Daemon is not running. Start it first.'); process.exitCode = 1; return; }
    const client = await getIpcClient();
    try {
      const response = await client.call(IPCCommand.WorkspaceList, { rootPath: root, relativePath: directoryPath });
      if (!response.success || !response.data) throw new Error(response.error?.message ?? 'Workspace list failed.');
      console.log(JSON.stringify(response.data, null, 2));
    } catch (error) { console.error(`Workspace list failed: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; }
    finally { client.disconnect(); }
  });

program
  .command('workspace:search')
  .description('Search an explicitly authorized workspace')
  .argument('<root>', 'Absolute workspace root')
  .argument('<query>', 'Text to search for')
  .action(async (root: string, query: string) => {
    if (!isRunning()) { console.error('Daemon is not running. Start it first.'); process.exitCode = 1; return; }
    const client = await getIpcClient();
    try {
      const response = await client.call(IPCCommand.WorkspaceSearch, { rootPath: root, query });
      if (!response.success || !response.data) throw new Error(response.error?.message ?? 'Workspace search failed.');
      console.log(JSON.stringify(response.data, null, 2));
    } catch (error) { console.error(`Workspace search failed: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; }
    finally { client.disconnect(); }
  });

program
  .command('workspace:execute')
  .description('Run an explicitly allowlisted command in a workspace (requires confirmation)')
  .argument('<root>', 'Absolute workspace root')
  .argument('<command>', 'Allowlisted executable')
  .argument('[args...]', 'Command arguments')
  .option('-a, --allowed <commands>', 'Comma-separated allowlist of executables', 'dotnet')
  .option('--yes', 'Skip the read-write confirmation prompt')
  .action(async (root: string, command: string, args: string[], options: { allowed: string; yes?: boolean }) => {
    if (!isRunning()) { console.error('Daemon is not running. Start it first.'); process.exitCode = 1; return; }
    const allowedCommands = options.allowed.split(',').map((c) => c.trim()).filter(Boolean);
    if (!allowedCommands.includes(command)) {
      console.error(`Command '${command}' is not in the allowlist: ${allowedCommands.join(', ')}`);
      process.exitCode = 1;
      return;
    }
    if (!options.yes) {
      const confirmed = await confirmAction(
        `Run '${command} ${args.join(' ')}' in a READ-WRITE session on ${root}? (yes/no) `,
      );
      if (!confirmed) {
        console.log('Aborted by user.');
        process.exitCode = 1;
        return;
      }
    }
    const client = await getIpcClient();
    try {
      const response = await client.call(IPCCommand.WorkspaceExecute, { rootPath: root, command, args });
      if (!response.success || !response.data) throw new Error(response.error?.message ?? 'Workspace execution failed.');
      console.log(JSON.stringify(response.data, null, 2));
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : String(error);
      console.error(`Workspace execution failed: ${message}`);
      process.exitCode = 1;
    }
    finally { client.disconnect(); }
  });

program
  .command('workspace:grant')
  .description('Register a session-scoped workspace grant for this CLI session')
  .argument('<root>', 'Absolute workspace root')
  .option('-m, --mode <mode>', 'read-only or read-write', 'read-only')
  .option('-t, --tools <tools>', 'Comma-separated tools: list,read,search,execute,apply', 'list,read,search')
  .option('-a, --allowed <commands>', 'Comma-separated allowlisted executables (for execute)')
  .option('-e, --expires <iso>', 'Optional ISO expiration timestamp')
  .action(async (root: string, options: { mode: string; tools: string; allowed?: string; expires?: string }) => {
    if (!isRunning()) { console.error('Daemon is not running. Start it first.'); process.exitCode = 1; return; }
    const mode = (options.mode === 'read-write' ? 'read-write' : 'read-only') as WorkspaceMode;
    const tools = options.tools.split(',').map((t) => t.trim()).filter(Boolean) as WorkspaceTool[];
    const allowedCommands = options.allowed?.split(',').map((c) => c.trim()).filter(Boolean);
    if (mode === 'read-write') {
      const confirmed = await confirmAction(`Grant READ-WRITE access to ${root} for this CLI session? (yes/no) `);
      if (!confirmed) { console.log('Aborted by user.'); process.exitCode = 1; return; }
    }
    const client = await getIpcClient();
    try {
      const resp = await client.call(IPCCommand.WorkspaceGrant, {
        rootPath: root,
        mode,
        tools,
        allowedCommands,
        expiresAt: options.expires,
      });
      if (!resp.success) throw new Error(resp.error?.message ?? 'Grant registration failed.');
      console.log(JSON.stringify({ session: client.session, ...(resp.data as object) }, null, 2));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Workspace grant failed: ${message}`);
      process.exitCode = 1;
    } finally { client.disconnect(); }
  });

program
  .command('workspace:grants')
  .description('List active grants for this CLI session (audit-safe, no secrets)')
  .action(async () => {
    if (!isRunning()) { console.error('Daemon is not running. Start it first.'); process.exitCode = 1; return; }
    const client = await getIpcClient();
    try {
      const resp = await client.call(IPCCommand.WorkspaceGrantList);
      if (!resp.success) throw new Error(resp.error?.message ?? 'Grant listing failed.');
      console.log(JSON.stringify(resp.data, null, 2));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Grant listing failed: ${message}`);
      process.exitCode = 1;
    } finally { client.disconnect(); }
  });

program
  .command('workspace:revoke')
  .description('Revoke grants for this CLI session (all, or one root)')
  .argument('[root]', 'Optional absolute workspace root; omit to revoke all')
  .action(async (root?: string) => {
    if (!isRunning()) { console.error('Daemon is not running. Start it first.'); process.exitCode = 1; return; }
    const client = await getIpcClient();
    try {
      const resp = await client.call(IPCCommand.WorkspaceRevoke, root ? { rootPath: root } : undefined);
      if (!resp.success) throw new Error(resp.error?.message ?? 'Grant revocation failed.');
      console.log(JSON.stringify(resp.data, null, 2));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Grant revocation failed: ${message}`);
      process.exitCode = 1;
    } finally { client.disconnect(); }
  });

// ---- workspace mutation lifecycle (preview -> approve -> apply) ----

// Commander v12 repeatable-option collector.
function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

// Build the ordered change set from repeatable --file/--content/--hash options.
function buildWorkspaceChanges(options: { file: string[]; content: string[]; hash: string[] }): Array<{
  relativePath: string;
  content: string;
  expectedHash?: string;
}> {
  const fileCount = options.file.length;
  const contentCount = options.content.length;
  if (fileCount === 0) {
    throw new Error('Provide at least one --file and one --content pair.');
  }
  if (fileCount !== contentCount) {
    throw new Error(
      `--file and --content must appear the same number of times (got ${fileCount} file(s), ${contentCount} content(s)).`,
    );
  }
  if (options.hash.length !== 0 && options.hash.length !== fileCount) {
    throw new Error(
      `--hash must be omitted entirely or provided exactly once per --file (got ${options.hash.length} hash(es) for ${fileCount} file(s)).`,
    );
  }
  return options.file.map((relativePath, index) => ({
    relativePath,
    content: options.content[index],
    ...(options.hash[index] !== undefined ? { expectedHash: options.hash[index] } : {}),
  }));
}

program
  .command('workspace:preview')
  .description('Preview workspace file changes without writing anything (requires an apply grant)')
  .argument('<root>', 'Absolute workspace root')
  .option('-f, --file <relPath>', 'File to create or update; repeat once per change, in order', collect, [])
  .option('-c, --content <text>', 'New content for each --file; repeat in the same order', collect, [])
  .option('--hash <sha256>', 'Expected sha256 baseline for an existing file; optional, repeat per file', collect, [])
  .action(async (root: string, options: { file: string[]; content: string[]; hash: string[] }) => {
    if (!isRunning()) { console.error('Daemon is not running. Start it first.'); process.exitCode = 1; return; }
    const client = await getIpcClient();
    try {
      const changes = buildWorkspaceChanges(options);
      const response = await client.call(IPCCommand.WorkspacePreview, { rootPath: root, changes });
      if (!response.success || !response.data) throw new Error(response.error?.message ?? 'Workspace preview failed.');
      const data = response.data as { diffHash: string; files: Array<{ relativePath: string; expectedHash: string; size: number }> };
      console.log(JSON.stringify(data, null, 2));
      console.error(`Use this diffHash with workspace:approve: ${data.diffHash}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Workspace preview failed: ${message}`);
      process.exitCode = 1;
    } finally { client.disconnect(); }
  });

program
  .command('workspace:approve')
  .description('Approve a previewed diff; returns a single-use approvalId (requires confirmation)')
  .argument('<root>', 'Absolute workspace root')
  .argument('<diffHash>', 'diffHash returned by workspace:preview')
  .option('-t, --ttl <seconds>', 'Approval TTL in seconds (capped at 300)', '60')
  .option('--yes', 'Skip the read-write confirmation prompt')
  .action(async (root: string, diffHash: string, options: { ttl: string; yes?: boolean }) => {
    if (!isRunning()) { console.error('Daemon is not running. Start it first.'); process.exitCode = 1; return; }
    const ttl = Number(options.ttl);
    if (!Number.isFinite(ttl) || ttl <= 0) {
      console.error('--ttl must be a positive number of seconds');
      process.exitCode = 1;
      return;
    }
    const confirmed = options.yes
      ? true
      : await confirmAction(`Approve applying changes to ${root} (diffHash ${diffHash})? (yes/no) `);
    if (!confirmed) { console.log('Aborted by user.'); process.exitCode = 1; return; }
    const client = await getIpcClient();
    try {
      const response = await client.call(IPCCommand.WorkspaceApprove, {
        rootPath: root,
        diffHash,
        expiresInSeconds: ttl,
      });
      if (!response.success || !response.data) throw new Error(response.error?.message ?? 'Workspace approval failed.');
      // Audit-safe: the response carries no secret token.
      console.log(JSON.stringify(response.data, null, 2));
      const data = response.data as { approvalId: string };
      console.error(`Use this approvalId with workspace:apply: ${data.approvalId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Workspace approval failed: ${message}`);
      process.exitCode = 1;
    } finally { client.disconnect(); }
  });

program
  .command('workspace:apply')
  .description('Apply a previously approved diff using its single-use approvalId (requires confirmation)')
  .argument('<root>', 'Absolute workspace root')
  .argument('<approvalId>', 'approvalId returned by workspace:approve')
  .option('-f, --file <relPath>', 'File to create or update; repeat once per change, in order', collect, [])
  .option('-c, --content <text>', 'New content for each --file; repeat in the same order', collect, [])
  .option('--hash <sha256>', 'Expected sha256 baseline for an existing file; optional, repeat per file', collect, [])
  .option('--yes', 'Skip the apply confirmation prompt')
  .action(async (root: string, approvalId: string, options: { file: string[]; content: string[]; hash: string[]; yes?: boolean }) => {
    if (!isRunning()) { console.error('Daemon is not running. Start it first.'); process.exitCode = 1; return; }
    const confirmed = options.yes
      ? true
      : await confirmAction(`Apply approved changes (approvalId ${approvalId}) to ${root}? (yes/no) `);
    if (!confirmed) { console.log('Aborted by user.'); process.exitCode = 1; return; }
    const client = await getIpcClient();
    try {
      const changes = buildWorkspaceChanges(options);
      const response = await client.call(IPCCommand.WorkspaceApply, {
        rootPath: root,
        approvalId,
        changes,
      });
      if (!response.success || !response.data) throw new Error(response.error?.message ?? 'Workspace apply failed.');
      console.log(JSON.stringify(response.data, null, 2));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Workspace apply failed: ${message}`);
      process.exitCode = 1;
    } finally { client.disconnect(); }
  });

program
  .command('review-workspace')
  .description('Inspect an authorized workspace and ask the Runtime for a review')
  .argument('<root>', 'Absolute workspace root')
  .argument('<prompt>', 'Review instruction')
  .action(async (root: string, prompt: string) => {
    if (!isRunning()) { console.error('Daemon is not running. Start it first.'); process.exitCode = 1; return; }
    const client = await getIpcClient();
    try {
      const listResponse = await client.call(IPCCommand.WorkspaceList, { rootPath: root, relativePath: '.' });
      if (!listResponse.success) throw new Error(listResponse.error?.message ?? 'Workspace listing failed.');
      const readResponse = await client.call(IPCCommand.WorkspaceRead, { rootPath: root, relativePath: 'README.md', mode: 'read-only' });
      const readme = readResponse.success && readResponse.data
        ? (readResponse.data as { content: string }).content.slice(0, 20_000)
        : 'README.md unavailable';
      const context = JSON.stringify({ structure: listResponse.data, readme });
      const askResponse = await client.call(IPCCommand.Ask, {
        prompt: `${prompt}\n\nUse only this authorized workspace context:\n${context}`,
      });
      if (!askResponse.success || !askResponse.data) throw new Error(askResponse.error?.message ?? 'Workspace review failed.');
      console.log((askResponse.data as { content: string }).content);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : String(error);
      console.error(`Workspace review failed: ${message}`);
      process.exitCode = 1;
    } finally { client.disconnect(); }
  });

program
  .command('create-html')
  .description('Create a simple HTML page in the workspace')
  .argument('[target]', 'Relative output path', 'prototype/hello-world.html')
  .option('-t, --title <title>', 'Document title', 'Hello World')
  .option('-k, --kind <kind>', 'Template kind: hello or login', 'hello')
  .action(async (target: string, options: { title?: string; kind?: string }) => {
    try {
      const targetPath = resolve(process.cwd(), target);
      const outputDir = dirname(targetPath);
      await fs.mkdir(outputDir, { recursive: true });

      const kind = (options.kind ?? 'hello').toLowerCase();
      const title = options.title ?? (kind === 'login' ? 'Sign in' : 'Hello World');

      const html = kind === 'login'
        ? `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>
      :root {
        --bg: #0f172a;
        --panel: #111827;
        --panel-border: rgba(148, 163, 184, 0.2);
        --primary: #60a5fa;
        --text: #f8fafc;
        --muted: #cbd5e1;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        font-family: Arial, sans-serif;
        background: linear-gradient(135deg, #020817, #111827 45%, #0f172a);
        color: var(--text);
      }
      .card {
        width: min(92vw, 420px);
        background: rgba(17, 24, 39, 0.92);
        border: 1px solid var(--panel-border);
        border-radius: 18px;
        padding: 2rem;
        box-shadow: 0 20px 45px rgba(15, 23, 42, 0.6);
      }
      h1 {
        margin: 0 0 0.5rem;
        font-size: 2rem;
      }
      p {
        margin: 0 0 1.5rem;
        color: var(--muted);
      }
      label {
        display: block;
        margin-bottom: 0.5rem;
        font-size: 0.9rem;
        color: var(--muted);
      }
      input {
        width: 100%;
        padding: 0.85rem 0.9rem;
        border-radius: 10px;
        border: 1px solid var(--panel-border);
        background: rgba(15, 23, 42, 0.9);
        color: var(--text);
        margin-bottom: 1rem;
      }
      button {
        width: 100%;
        padding: 0.9rem;
        border: none;
        border-radius: 10px;
        background: linear-gradient(135deg, var(--primary), #2563eb);
        color: #fff;
        font-weight: 700;
        cursor: pointer;
      }
      .meta {
        margin-top: 1rem;
        font-size: 0.82rem;
        color: var(--muted);
        text-align: center;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>${title}</h1>
      <p>Welcome back. Enter your account details.</p>
      <form>
        <label for="email">Email</label>
        <input id="email" type="email" placeholder="user@example.com" />

        <label for="password">Password</label>
        <input id="password" type="password" placeholder="••••••••" />

        <button type="submit">Log in</button>
      </form>
      <div class="meta">Generated by the Aer CLI.</div>
    </main>
  </body>
</html>
`
        : `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        font-family: Arial, sans-serif;
        background: #111827;
        color: #f9fafb;
      }
      main {
        text-align: center;
        padding: 2rem;
      }
      h1 {
        font-size: clamp(2rem, 5vw, 4rem);
        margin-bottom: 0.5rem;
      }
      p {
        font-size: 1.1rem;
        opacity: 0.8;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <p>Generated by the Aer CLI.</p>
    </main>
  </body>
</html>
`;

      await fs.writeFile(targetPath, html, 'utf8');
      console.log(`Created HTML page at ${relative(process.cwd(), targetPath)}`);
    } catch (error) {
      console.error('Failed to create HTML page:', error);
      process.exit(1);
    }
  });

program
  .command('review-status')
  .description('Review a target project directory and summarize its delivery status')
  .argument('<target>', 'Project path to inspect')
  .action(async (target: string) => {
    try {
      const projectRoot = resolve(process.cwd(), target);
      const exists = await fs.access(projectRoot).then(() => true).catch(() => false);

      if (!exists) {
        console.log(`Project not found: ${projectRoot}`);
        process.exitCode = 1;
        return;
      }

      const entries = await fs.readdir(projectRoot, { withFileTypes: true });
      const fileNames = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
      const dirNames = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

      const packageJsonExists = fileNames.includes('package.json');
      const readmeExists = fileNames.some((name) => /^readme/i.test(name));
      const srcExists = dirNames.includes('src');
      const distExists = dirNames.includes('dist');
      const hasNodeModules = dirNames.includes('node_modules');
      const dotnetSolutionFiles = fileNames.filter((name) => /\.(sln|slnx)$/i.test(name));
      const dotnetProjectFiles = fileNames.filter((name) => /\.csproj$/i.test(name));
      const hasGit = dirNames.includes('.git');
      const hasDotnetFolder = dirNames.some((name) => /^\.dotnet$/i.test(name));

      const topFiles = fileNames.slice(0, 12).join(', ') || 'none';
      const topDirs = dirNames.slice(0, 12).join(', ') || 'none';

      const gitStatus = await execFileAsync('git', ['-C', projectRoot, 'status', '--short', '--branch'], { timeout: 15000 })
        .then((result) => result.stdout.trim() || 'git status available but empty')
        .catch(() => 'git status unavailable');

      let dotnetVersion = 'dotnet unavailable';
      try {
        const result = await execFileAsync('dotnet', ['--version'], { timeout: 15000, windowsHide: true });
        dotnetVersion = result.stdout.trim() || 'dotnet installed';
      } catch {
        dotnetVersion = 'dotnet unavailable';
      }

      let buildStatus = 'not attempted';
      if (dotnetSolutionFiles.length > 0 || dotnetProjectFiles.length > 0) {
        const selectedSolution = dotnetSolutionFiles[0] || dotnetProjectFiles[0];
        try {
          const result = await execFileAsync('dotnet', ['build', selectedSolution, '--nologo', '-v', 'minimal'], {
            cwd: projectRoot,
            timeout: 120000,
            windowsHide: true,
          });
          buildStatus = result.stdout.trim() || 'build completed successfully';
        } catch (error: any) {
          buildStatus = error?.stderr?.trim() || error?.message || 'build failed';
        }
      }

      console.log(`Project review: ${projectRoot}`);
      console.log('--- delivery-manager status ---');
      console.log(`- Exists: yes`);
      console.log(`- Git repo: ${hasGit ? 'yes' : 'no'}`);
      console.log(`- README: ${readmeExists ? 'present' : 'missing'}`);
      console.log(`- package.json: ${packageJsonExists ? 'present' : 'missing'}`);
      console.log(`- src/: ${srcExists ? 'present' : 'missing'}`);
      console.log(`- dist/: ${distExists ? 'present' : 'missing'}`);
      console.log(`- node_modules/: ${hasNodeModules ? 'present' : 'missing'}`);
      console.log(`- .NET solution files: ${dotnetSolutionFiles.length > 0 ? dotnetSolutionFiles.join(', ') : 'none'}`);
      console.log(`- .NET project files: ${dotnetProjectFiles.length > 0 ? dotnetProjectFiles.join(', ') : 'none'}`);
      console.log(`- .git directory: ${hasGit ? 'present' : 'missing'}`);
      console.log(`- .dotnet folder: ${hasDotnetFolder ? 'present' : 'missing'}`);
      console.log(`- Top-level files: ${topFiles}`);
      console.log(`- Top-level folders: ${topDirs}`);
      console.log(`- Git status: ${gitStatus}`);
      console.log(`- .NET SDK: ${dotnetVersion}`);
      console.log(`- Build check: ${buildStatus.slice(0, 400) || 'no output'}`);

      const projectTypes: string[] = [];
      if (dotnetSolutionFiles.length > 0 || dotnetProjectFiles.length > 0) projectTypes.push('.NET solution/project');
      if (packageJsonExists) projectTypes.push('Node.js package');
      if (srcExists) projectTypes.push('source code tree');
      if (dirNames.some((name) => /gui|client|app|web/i.test(name))) projectTypes.push('UI/client app');
      if (dirNames.some((name) => /tests|test/i.test(name))) projectTypes.push('test project');

      console.log(`- Detected project types: ${projectTypes.length > 0 ? projectTypes.join(', ') : 'unknown'}`);

      if (!packageJsonExists && dotnetSolutionFiles.length === 0 && dotnetProjectFiles.length === 0) {
        console.log('Assessment: this is not a Node.js or .NET project in its current folder structure; it may be a monorepo or a non-buildable archive.');
      } else if (dotnetSolutionFiles.length > 0 || dotnetProjectFiles.length > 0) {
        console.log('Assessment: this project is a .NET-oriented solution and should be reviewed as a C#/.NET delivery artifact, not as a Node package.');
      } else if (!srcExists) {
        console.log('Assessment: package manifest exists, but the source tree is missing, so runtime delivery is not yet initialized.');
      } else {
        console.log('Assessment: project structure looks initialized enough for a delivery review; confirm build/test tasks for the current branch before release.');
      }
    } catch (error) {
      console.error('Failed to review project:', error);
      process.exit(1);
    }
  });

program.parse();
