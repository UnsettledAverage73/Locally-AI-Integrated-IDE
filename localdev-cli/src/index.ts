import { Command } from 'commander';
import chalk from 'chalk';
import { intro, outro, spinner, note, text, isCancel, cancel, confirm, select } from '@clack/prompts';
import { api } from './api.js';

const program = new Command();

const BANNER = `
${chalk.bold.blue('  _      ____   _____          _      _____  ________      __ ')}
${chalk.bold.blue(' | |    / __ \\ / ____|   /\\   | |    |  __ \\|  ____\\ \\    / / ')}
${chalk.bold.blue(' | |   | |  | | |       /  \\  | |    | |  | | |__   \\ \\  / /  ')}
${chalk.bold.blue(' | |   | |  | | |      / /\\ \\ | |    | |  | |  __|   \\ \\/ /   ')}
${chalk.bold.blue(' | |___| |__| | |____ / ____ \\| |____| |__| | |____   \\  /    ')}
${chalk.bold.blue(' |______\\____/ \\_____/_/    \\_\\______|_____/|______|   \\/     ')}
`;

const TIPS = [
  'Ask questions about your codebase, the CLI will use RAG context automatically.',
  'Use "ld scaffold" to generate an entire project structure in one go.',
  'Try "ld do <task>" for fully autonomous task execution.',
  'Check system resources and model status with "ld status".',
  'Connect to AWS Bedrock with "ld cloud login" for cloud-scale brains.'
];

function showHeader() {
  process.stdout.write(BANNER + '\n');
  console.log(chalk.dim(' Tips for getting started:'));
  TIPS.forEach((tip, i) => console.log(chalk.dim(` ${i + 1}. ${tip}`)));
  console.log('\n');
}

program
  .name('ld')
  .description('LocalDev CLI - Your terminal interface for the local AI IDE')
  .version('1.1.0')
  .action(() => {
    if (process.argv.length <= 2) {
      showHeader();
      startInteractiveShell();
    }
  });

async function startInteractiveShell() {
  const status = await api.getStatus();
  const backendLabel = status.error ? chalk.red('Offline') : chalk.green('Online');
  const modelLabel = status.active_model ? chalk.cyan(status.active_model) : chalk.dim('None');
  
  note(
    `Backend: ${backendLabel} | Model: ${modelLabel} | Mode: ${chalk.bold(status.mode || 'local')}`,
    'LocalDev Shell'
  );

  const input = await text({
    message: chalk.bold('Ask LocalDev:'),
    placeholder: 'Ask anything or type "/help" for commands...',
  });

  if (isCancel(input)) {
    outro('Goodbye!');
    process.exit(0);
  }

  const query = input as string;

  if (query.startsWith('/')) {
    const cmd = query.slice(1);
    if (cmd === 'help') {
      program.help();
    } else if (cmd === 'exit' || cmd === 'quit') {
      outro('Goodbye!');
      process.exit(0);
    } else if (cmd === 'do') {
        const taskInput = await text({ message: 'What autonomous task should I perform?' });
        if (!isCancel(taskInput)) await runAutonomousTask(taskInput as string);
    } else {
      console.log(chalk.yellow(`Unknown command: ${cmd}. Type /help for a list of commands.`));
      startInteractiveShell();
    }
    return;
  }

  await runChat(query);
}

async function runChat(prompt: string, messages: any[] = [], autonomous: boolean = false) {
  const status = await api.getStatus();
  if (status.error) {
    cancel('Backend unreachable. Please start the LocalDev server.');
    return;
  }

  const s = spinner();
  s.start(chalk.dim(autonomous ? 'Agent is working...' : 'Thinking...'));
  
  const socket = api.createChatSocket();
  let fullResponse = '';
  
  socket.on('open', () => {
    socket.send(JSON.stringify({
      type: 'chat',
      model: status.active_model,
      messages: [...messages, { role: 'user', content: prompt }],
      session_id: 'cli-shell'
    }));
  });

  socket.on('message', async (data) => {
    const payload = JSON.parse(data.toString());
    
    if (payload.type === 'content_delta') {
      if (fullResponse === '') {
        s.stop(chalk.bold.blue(autonomous ? 'Agent Output:' : 'Assistant:'));
      }
      process.stdout.write(payload.content);
      fullResponse += payload.content;
    } else if (payload.type === 'tool_calls') {
      const calls = payload.tool_calls;
      
      if (autonomous) {
        // Trace thoughts for autonomous mode
        process.stdout.write(chalk.dim(`\n[Action: ${calls[0].function.name}] ${JSON.stringify(calls[0].function.arguments)}\n`));
        
        socket.send(JSON.stringify({
            type: 'tool_exec',
            model: status.active_model,
            messages: payload.messages,
            tool_call: calls[0],
            approved: true
        }));
      } else {
        s.stop(chalk.yellow('Tool Call Requested'));
        for (const call of calls) {
            note(`${call.function.name}(${call.function.arguments})`, 'Tool Call');
        }
        
        const approved = await confirm({ message: 'Allow these tool calls?' });
        
        socket.send(JSON.stringify({
            type: 'tool_exec',
            model: status.active_model,
            messages: payload.messages,
            tool_call: calls[0],
            approved: !isCancel(approved) && approved
        }));
        
        s.start(chalk.dim('Executing tool and thinking...'));
        fullResponse = ''; 
      }
    } else if (payload.type === 'complete') {
      process.stdout.write('\n\n');
      socket.close();
      if (!autonomous) startInteractiveShell(); 
    } else if (payload.type === 'error') {
      s.stop(chalk.red('Error'));
      note(payload.error, 'AI Error');
      socket.close();
      if (!autonomous) startInteractiveShell();
    }
  });
}

async function runAutonomousTask(task: string) {
    intro(chalk.bold.magenta('🚀 Starting Autonomous Agent Mode'));
    note(`Objective: ${task}`, 'Mission');
    await runChat(task, [], true);
    outro(chalk.bold.magenta('🏁 Mission Accomplished.'));
    startInteractiveShell();
}

// --- AGENT DO ---
program
  .command('do')
  .description('Run a fully autonomous task (AGI mode)')
  .argument('<task>', 'The objective for the agent')
  .action(async (task) => {
    await runAutonomousTask(task);
  });

// --- STATUS ---
program
  .command('status')
  .description('Check the status of the LocalDev backend and services')
  .action(async () => {
    intro(chalk.bold.cyan('LocalDev Status'));
    const s = spinner();
    s.start('Checking backend connectivity...');
    
    const status = await api.getStatus();
    
    if (status.error) {
      s.stop(chalk.red('Backend unreachable'));
      note(
        chalk.yellow('Make sure the LocalDev backend is running on http://localhost:8000.\nYou can start it using "npm start" in the project root.'),
        'Troubleshooting'
      );
      outro(chalk.red('Failed to connect to backend.'));
      return;
    }

    s.stop(chalk.green('Backend connected'));
    
    const resources = await api.getSystemResources();
    
    note(
      `Mode: ${chalk.bold(status.mode)}\n` +
      `Active Model: ${chalk.bold(status.active_model || 'None')}\n` +
      `Ollama Host: ${chalk.bold(status.ollama_host || 'localhost:11434')}\n` +
      `CPU Usage: ${chalk.bold(resources.cpu_percent)}%\n` +
      `RAM Usage: ${chalk.bold(resources.ram_percent)}%`,
      'System Info'
    );
    
    outro(chalk.cyan('LocalDev is ready.'));
  });

// --- MODELS ---
const models = program.command('model').description('Manage Ollama models');

models
  .command('list')
  .description('List available Ollama models')
  .action(async () => {
    intro(chalk.bold.cyan('Ollama Models'));
    const s = spinner();
    s.start('Fetching models...');
    const data = await api.listModels();
    s.stop('Models fetched');

    if (data.models && data.models.length > 0) {
      const modelList = data.models.map((m: any) => `- ${chalk.bold(m.name)} (${(m.size / 1024 / 1024 / 1024).toFixed(2)} GB)`).join('\n');
      note(modelList, 'Available Models');
    } else {
      note('No models found. Use "ollama pull <model>" to download one.', 'Info');
    }
    outro(chalk.cyan('Ready.'));
  });

models
  .command('show <name>')
  .description('Show detailed info about a model')
  .action(async (name) => {
    intro(chalk.bold.cyan(`Model Info: ${name}`));
    const s = spinner();
    s.start('Fetching info...');
    const info = await api.showModel(name);
    s.stop('Info fetched');

    if (info.error) {
      note(info.error, 'Error');
    } else {
      let details = `Family: ${chalk.bold(info.details?.family || 'N/A')}\n`;
      details += `Format: ${chalk.bold(info.details?.format || 'N/A')}\n`;
      details += `Parameter Size: ${chalk.bold(info.details?.parameter_size || 'N/A')}\n`;
      details += `Quantization: ${chalk.bold(info.details?.quantization_level || 'N/A')}\n`;
      details += `\nLicense: ${info.license ? info.license.slice(0, 100) + '...' : 'N/A'}`;
      
      note(details, 'Details');
      if (info.modelfile) {
        note(info.modelfile.slice(0, 500) + (info.modelfile.length > 500 ? '...' : ''), 'Modelfile');
      }
    }
    outro(chalk.cyan('Ready.'));
  });

models
  .command('use <name>')
  .description('Set the active model for chat and coding')
  .action(async (name) => {
    intro(chalk.bold.cyan(`Switching Model: ${name}`));
    const s = spinner();
    s.start(`Setting ${name} as active model...`);
    const res = await api.setActiveModel(name);
    if (res.status === 'success') {
      s.stop(chalk.green(`Active model set to ${name}!`));
    } else {
      s.stop(chalk.red('Failed to set active model'));
      note(res.error || 'Unknown error', 'Error');
    }
    outro(chalk.cyan('Ready.'));
  });

// --- CLOUD ---
const cloud = program.command('cloud').description('Cloud instance and connectivity management');

cloud
  .command('login')
  .description('Configure AWS Bedrock connectivity (Cloud Mode)')
  .action(async () => {
    intro(chalk.bold.cyan('Cloud Connection'));
    
    const access_key = await text({ message: 'AWS Access Key ID:' });
    if (isCancel(access_key)) return;
    
    const secret_key = await text({ message: 'AWS Secret Access Key:' });
    if (isCancel(secret_key)) return;
    
    const region = await text({ message: 'AWS Region:', initialValue: 'us-east-1' });
    if (isCancel(region)) return;

    const s = spinner();
    s.start('Connecting to LocalDev Cloud...');
    const res = await api.setCloudMode({ 
      access_key: access_key as string, 
      secret_key: secret_key as string, 
      region: region as string 
    });
    
    if (res.status === 'success') {
      s.stop(chalk.green('Cloud Mode Active!'));
      note('Your IDE is now using AWS Bedrock for high-performance inference.', 'Mode Switch');
    } else {
      s.stop(chalk.red('Failed to enable cloud mode'));
      note(res.error || 'Unknown error', 'Error');
    }
    outro(chalk.cyan('Ready.'));
  });

cloud
  .command('status')
  .description('List cloud instances')
  .action(async () => {
    intro(chalk.bold.cyan('Cloud Instances'));
    const status = await api.getStatus();
    if (status.mode !== 'cloud') {
       note('You are in Local mode. Run "ld cloud login" first to use cloud management features.', 'Info');
       return;
    }

    const s = spinner();
    s.start('Fetching instances...');
    const res = await api.listCloudInstances({}); 
    s.stop('Instances fetched');

    if (res.instances && res.instances.length > 0) {
      const list = res.instances.map((i: any) => `- ${chalk.bold(i.instance_id)} (${i.state}) - ${i.public_ip || 'No IP'}`).join('\n');
      note(list, 'Active Instances');
    } else {
      note('No cloud instances found.', 'Info');
    }
    outro(chalk.cyan('Ready.'));
  });

// --- REVIEW ---
program
  .command('review')
  .description('Perform an autonomous workspace review')
  .action(async () => {
    await runAutonomousTask("Perform a comprehensive review of the current workspace. Identify bugs, architectural inconsistencies, and security flaws. Report your findings and propose fixes.");
  });

// --- CHAT ---
program
  .command('chat')
  .description('Start a quick chat session')
  .argument('[prompt]', 'Initial prompt')
  .action(async (prompt) => {
    intro(chalk.bold.cyan('LocalDev Chat'));
    if (!prompt) {
       const input = await text({ message: 'How can I help you?' });
       if (isCancel(input)) return;
       await runChat(input as string);
    } else {
       await runChat(prompt);
    }
  });

// --- GIT ---
const git = program.command('git').description('Git operations with AI assistance');

git
  .command('status')
  .description('Show git status')
  .action(async () => {
    intro(chalk.bold.cyan('Git Status'));
    const s = spinner();
    s.start('Fetching status...');
    const data = await api.getGitStatus();
    s.stop('Status fetched');

    if (data.changes && data.changes.length > 0) {
      const list = data.changes.map((c: any) => `${c.staged ? chalk.green('S') : chalk.red('M')} ${c.path}`).join('\n');
      note(list, 'Changes');
    } else {
      note('No changes detected.', 'Info');
    }
    outro(chalk.cyan('Ready.'));
  });

git
  .command('commit')
  .description('Generate AI commit message and commit staged changes')
  .option('-m, --message <msg>', 'Manually specify commit message')
  .action(async (options) => {
    intro(chalk.bold.cyan('Git Commit'));
    const s = spinner();
    
    let message = options.message;
    if (!message) {
      s.start('Generating AI commit message...');
      const data = await api.generateCommitMessage();
      s.stop('Message generated');
      
      message = await text({
        message: 'Review commit message:',
        initialValue: data.message,
      });
      
      if (isCancel(message)) {
        cancel('Commit cancelled.');
        return;
      }
    }

    s.start('Committing changes...');
    const result = await api.commit(message as string);
    if (result.status === 'success') {
      s.stop(chalk.green('Committed successfully!'));
    } else {
      s.stop(chalk.red('Commit failed'));
      note(result.error || 'Unknown error', 'Error');
    }
    outro(chalk.cyan('Ready.'));
  });

// --- RAG ---
program
  .command('index')
  .description('Index a directory for RAG')
  .argument('[path]', 'Directory path to index', '.')
  .action(async (path) => {
    intro(chalk.bold.cyan('RAG Indexing'));
    const s = spinner();
    s.start(`Indexing ${path}...`);
    const result = await api.indexDirectory(path);
    if (result.status === 'success') {
      s.stop(chalk.green('Indexing complete!'));
      note(result.message, 'Success');
    } else {
      s.stop(chalk.red('Indexing failed'));
      note(result.error || 'Unknown error', 'Error');
    }
    outro(chalk.cyan('Ready.'));
  });

program
  .command('search')
  .description('Perform semantic search across the codebase')
  .argument('<query>', 'Search query')
  .action(async (query) => {
    intro(chalk.bold.cyan('Semantic Search'));
    const s = spinner();
    s.start('Searching...');
    const result = await api.semanticSearch(query);
    s.stop('Search complete');
    
    if (result.context) {
      note(result.context, 'Results');
    } else {
      note('No relevant context found.', 'Info');
    }
    outro(chalk.cyan('Ready.'));
  });

// --- RALPH ---
const ralph = program.command('ralph').description('Manage autonomous Ralph engine loops');

ralph
  .command('start')
  .description('Start an autonomous loop')
  .argument('[dir]', 'Working directory', '.')
  .option('-m, --model <model>', 'Model to use')
  .action(async (dir, options) => {
    intro(chalk.bold.cyan('Ralph Engine'));
    const s = spinner();
    s.start(`Starting Ralph in ${dir}...`);
    const result = await api.startRalph(dir, options.model);
    if (result.status === 'started') {
      s.stop(chalk.green('Ralph loop started!'));
      note(`Task ID: ${chalk.bold(result.task_id)}\nWork Dir: ${result.work_dir}`, 'Task Info');
      outro(`Use "ld ralph status ${result.task_id}" to monitor progress.`);
    } else {
      s.stop(chalk.red('Failed to start Ralph'));
      note(result.error || 'Unknown error', 'Error');
      outro('Check backend logs for details.');
    }
  });

ralph
  .command('status')
  .description('Check status of a Ralph task')
  .argument('<task_id>', 'ID of the task to check')
  .action(async (taskId) => {
    intro(chalk.bold.cyan('Ralph Status'));
    const s = spinner();
    s.start('Fetching status...');
    const result = await api.getRalphStatus(taskId);
    s.stop('Status fetched');
    
    note(
      `Status: ${chalk.bold(result.status)}\n` +
      `Progress: ${result.current_progress || 'N/A'}`,
      'Task State'
    );
    
    if (result.logs) {
      note(result.logs, 'Latest Logs');
    }
    
    outro(chalk.cyan('Ready.'));
  });

// --- SCAFFOLD ---
program
  .command('scaffold')
  .description('Generate a new project structure using the Genesis Protocol')
  .argument('<prompt>', 'Project description')
  .action(async (prompt) => {
    intro(chalk.bold.cyan('Genesis Scaffolding'));
    note(`I will now generate a project based on: "${prompt}"`, 'Intent');
    
    const approved = await confirm({
      message: 'This will use the Architect persona to generate multiple files. Proceed?',
    });
    
    if (isCancel(approved) || !approved) {
      cancel('Scaffolding cancelled.');
      return;
    }

    const s = spinner();
    s.start(chalk.dim('Architect is planning and building...'));
    
    const status = await api.getStatus();
    const socket = api.createChatSocket();
    let fullResponse = '';

    socket.on('open', () => {
      socket.send(JSON.stringify({
        type: 'chat',
        model: status.active_model,
        messages: [{ role: 'user', content: `scaffold ${prompt}` }]
      }));
    });

    socket.on('message', async (data) => {
      const payload = JSON.parse(data.toString());
      if (payload.type === 'content_delta') {
        if (fullResponse === '') s.stop(chalk.bold.blue('Architect:'));
        process.stdout.write(payload.content);
        fullResponse += payload.content;
      } else if (payload.type === 'tool_calls') {
         const calls = payload.tool_calls;
         process.stdout.write('\n');
         s.stop(chalk.yellow('Architect wants to execute tools'));
         for (const call of calls) {
           note(`${call.function.name}(${call.function.arguments})`, 'Action');
         }
         
         const ok = await confirm({ message: 'Allow these actions?' });
         socket.send(JSON.stringify({ 
           type: 'tool_exec', 
           model: status.active_model, 
           messages: payload.messages, 
           tool_call: calls[0], 
           approved: !isCancel(ok) && ok 
         }));
         s.start(chalk.dim('Architect is working...'));
         fullResponse = '';
      } else if (payload.type === 'complete') {
        process.stdout.write('\n\n');
        socket.close();
        outro(chalk.green('Scaffolding process finished!'));
      }
    });
  });

program.parse();
