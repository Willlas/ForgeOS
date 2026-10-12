// Test script to run CLI via node directly
console.log("Testing direct execution");
const { spawn } = require('child_process');
const cliPath = 'packages/cli/src/index.ts';
console.log('Will try to spawn:', cliPath);