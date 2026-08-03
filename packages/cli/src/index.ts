/**
 * ForgeOS CLI - Connects to daemon process via IPC for runtime management.
 * Does NOT create Runtime instances directly.
 */

import { Command } from 'commander';
import { startDaemon, stopDaemon, restartDaemon, isRunning } from './daemon.js';
import { IpcClient } from './ipc-client.js';
import { IPCCommand } from '@aer/runtime-lib';

const program = new Command();

program
  .name('forgeos')
  .description('ForgeOS Runtime CLI')
  .version('0.1.0');

// Helper: create and connect an IPC client
async function getIpcClient(): Promise<IpcClient> {
  const client = new IpcClient();
  await client.connect();
  return client;
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
      console.log('Starting ForgeOS daemon...');
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
      console.log('Stopping ForgeOS daemon...');
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
      console.log('Restarting ForgeOS daemon...');
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

program.parse();
