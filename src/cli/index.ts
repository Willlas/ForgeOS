/**
 * ForgeOS CLI - Connects to daemon process for runtime management.
 * Does NOT create Runtime instances directly.
 */

import { Command } from 'commander';
import { startDaemon, stopDaemon, restartDaemon, isRunning } from '../runtime/daemon.js';

const program = new Command();

program
  .name('forgeos')
  .description('ForgeOS Runtime CLI')
  .version('0.1.0');

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
  .description('Show daemon status')
  .action(() => {
    const running = isRunning();
    console.log(`Daemon running: ${running ? 'Yes' : 'No'}`);
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
  .description('List configuration values')
  .action(() => {
    if (!isRunning()) {
      console.log('Daemon is not running. Start it first.');
      return;
    }
    console.log('Configuration:');
    console.log('- Environment: development');
    console.log('- Log Level: info');
  });

program.parse();
