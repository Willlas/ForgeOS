/**
 * Autonomous Engineering Runtime CLI
 * 
 * Provides command-line interface for managing the ForgeOS runtime.
 */

import { Command } from 'commander';
import { createInterface } from 'readline';
import { createRuntime, Runtime } from '../index.js';

const program = new Command();

program
  .name('aer')
  .description('Autonomous Engineering Runtime CLI')
  .version('0.1.0');

// Global runtime instance for CLI commands
let globalRuntime: Runtime | null = null;

// Runtime management commands
program
  .command('start')
  .description('Start the runtime')
  .option('-c, --config <path>', 'Configuration file path')
  .option('-l, --log-level <level>', 'Log level', 'info')
  .option('-e, --environment <env>', 'Environment', 'development')
  .action(async (options) => {
    try {
      console.log('Starting Autonomous Engineering Runtime...');
      
      // Create and start the runtime
      const runtime = createRuntime({
        logLevel: options.logLevel || 'info',
        environment: options.environment || 'development',
        // Add other config options here
      });
      
      await runtime.start();
      globalRuntime = runtime;
      
      console.log('Runtime started successfully');
      console.log('Type "help" for available commands, or "exit" to quit.');
      
      // Start interactive REPL
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      
      const prompt = () => {
        if (globalRuntime) {
          rl.question('aer> ', async (input) => {
            const args = input.trim().split(/\s+/);
            const cmd = args[0]?.toLowerCase();
            
            switch (cmd) {
              case 'help':
                console.log('Available commands:');
                console.log('  status          - Show runtime status');
                console.log('  config:list     - List configuration');
                console.log('  workflows:list  - List running workflows');
                console.log('  exit            - Stop runtime and exit');
                prompt();
                break;
               case 'status': {
                 if (!globalRuntime) {
                   console.log('Runtime not available');
                   prompt();
                   break;
                 }
                 const health = globalRuntime.getHealth();
                 const config = globalRuntime.getConfig();
                console.log(`Status: ${health.state}`);
                console.log(`Environment: ${config.environment}`);
                console.log(`Uptime: ${Math.round(health.uptimeSeconds)}s`);
                console.log(`Healthy: ${health.healthy ? 'Yes' : 'No'}`);
                prompt();
                break;
              }
               case 'config:list': {
                 if (!globalRuntime) {
                   console.log('Runtime not available');
                   prompt();
                   break;
                 }
                 const config = globalRuntime.getConfig();
                console.log(`Name: ${config.name}`);
                console.log(`Environment: ${config.environment}`);
                console.log(`Log Level: ${config.logLevel}`);
                prompt();
                break;
              }
              case 'workflows:list':
                console.log('No workflows currently running');
                prompt();
                break;
               case 'exit':
               case 'quit':
                 console.log('Shutting down runtime...');
                 if (globalRuntime) {
                   await globalRuntime.stop();
                 }
                rl.close();
                process.exit(0);
                break;
              default:
                if (cmd) console.log(`Unknown command: ${cmd}. Type "help" for available commands.`);
                prompt();
                break;
            }
          });
        }
      };
      
      prompt();

      process.on('SIGINT', async () => {
        console.log('\nShutting down runtime...');
        if (globalRuntime) {
          await globalRuntime.stop();
        }
        rl.close();
        console.log('Runtime stopped');
        process.exit(0);
      });
    } catch (error) {
      console.error('Failed to start runtime:', error);
      process.exit(1);
    }
  });

program
  .command('stop')
  .description('Stop the runtime')
  .action(async () => {
    try {
      if (!globalRuntime) {
        console.log('No runtime is currently running');
        return;
      }
      
      console.log('Stopping Autonomous Engineering Runtime...');
      await globalRuntime.stop();
      globalRuntime = null;
      console.log('Runtime stopped successfully');
    } catch (error) {
      console.error('Failed to stop runtime:', error);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show runtime status')
  .action(async () => {
    try {
      if (!globalRuntime) {
        console.log('Runtime is not running');
        return;
      }
      
      const health = globalRuntime.getHealth();
      const config = globalRuntime.getConfig();
      
      console.log('Autonomous Engineering Runtime Status:');
      console.log(`- Status: ${health.state}`);
      console.log(`- Environment: ${config.environment}`);
      console.log(`- Uptime: ${Math.round(health.uptimeSeconds)} seconds`);
      console.log(`- Healthy: ${health.healthy ? 'Yes' : 'No'}`);
      
      console.log('- Components:');
      for (const [component, healthy] of Object.entries(health.components)) {
        console.log(`  - ${component}: ${healthy ? 'Healthy' : 'Unhealthy'}`);
      }
    } catch (error) {
      console.error('Failed to get status:', error);
      process.exit(1);
    }
  });

// Workflow commands
program
  .command('workflows')
  .description('Manage workflows')
  .action(() => {
    console.log('Workflow management commands:');
    console.log('- aer workflows list');
    console.log('- aer workflows start <workflow-type>');
    console.log('- aer workflows status <workflow-id>');
    console.log('- aer workflows cancel <workflow-id>');
  });

program
  .command('workflows:list')
  .description('List all running workflows')
  .action(async () => {
    try {
      if (!globalRuntime) {
        console.log('No runtime is currently running. Start the runtime first.');
        return;
      }
      
      // In a real implementation, we would access workflow engine from runtime
      console.log('No workflows currently running');
      console.log('Note: Workflow engine integration needs to be implemented in runtime system');
    } catch (error) {
      console.error('Failed to list workflows:', error);
      process.exit(1);
    }
  });

program
  .command('workflows:start')
  .description('Start a new workflow')
  .argument('<workflow-type>', 'Workflow type (architect-to-worker, worker-to-reviewer, full-cycle)')
  .option('-t, --team <team-id>', 'Team ID to use', 'default-team')
  .action(async (workflowType) => {
    try {
      const workflowTypes = ['architect-to-worker', 'worker-to-reviewer', 'full-cycle'];
      
      if (!workflowTypes.includes(workflowType.toLowerCase())) {
        console.error(`Unknown workflow type: ${workflowType}`);
        console.log('Available types:');
        console.log('- architect-to-worker');
        console.log('- worker-to-reviewer');
        console.log('- full-cycle');
        process.exit(1);
      }
      
      // In a real implementation, we would submit the workflow to the runtime's workflow engine
      console.log(`Started workflow of type ${workflowType}`);
      console.log('Note: Workflow engine integration needs to be implemented in runtime system');
    } catch (error) {
      console.error('Failed to start workflow:', error);
      process.exit(1);
    }
  });

program
  .command('workflows:status')
  .description('Show status of a workflow')
  .argument('<workflow-id>', 'Workflow identifier')
  .action(async (workflowId) => {
    try {
      console.log(`Workflow status for ${workflowId}:`);
      console.log('Status: Not implemented in CLI (mock)');
      console.log('Note: Workflow engine integration needs to be implemented in runtime system');
    } catch (error) {
      console.error('Failed to get workflow status:', error);
      process.exit(1);
    }
  });

program
  .command('workflows:cancel')
  .description('Cancel a running workflow')
  .argument('<workflow-id>', 'Workflow identifier')
  .action(async (workflowId) => {
    try {
      console.log(`Cancelling workflow ${workflowId}:`);
      console.log('Cancel functionality not implemented in CLI (mock)');
      console.log('Note: Workflow engine integration needs to be implemented in runtime system');
    } catch (error) {
      console.error('Failed to cancel workflow:', error);
      process.exit(1);
    }
  });

// Configuration commands
program
  .command('config')
  .description('Manage configuration')
  .action(() => {
    console.log('Configuration commands:');
    console.log('- aer config get <key>');
    console.log('- aer config set <key> <value>');
    console.log('- aer config list');
  });

program
  .command('config:list')
  .description('List all configuration values')
  .action(async () => {
    try {
      if (!globalRuntime) {
        console.log('No runtime is currently running. Start the runtime first.');
        return;
      }
      
      const config = globalRuntime.getConfig();
      console.log('Runtime Configuration:');
      console.log(`- Name: ${config.name}`);
      console.log(`- Environment: ${config.environment}`);
      console.log(`- Log Level: ${config.logLevel}`);
      console.log(`- Metrics Enabled: ${config.metricsEnabled}`);
      console.log(`- Health Check Enabled: ${config.healthCheckEnabled}`);
    } catch (error) {
      console.error('Failed to list configuration:', error);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();