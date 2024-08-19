import { Kernel } from './kernel';
import { NotebookEnvironment } from "@/notebook-environment";
import vm from 'vm';
import { execSync } from 'child_process';
import path from 'path';
import * as acorn from 'acorn';

export class JavaScriptKernel implements Kernel {
    private packageCache: Set<string> = new Set();
    private aiLibraries: { [key: string]: any } = {};
    private logs: string[] = [];
    private sharedContext: { [key: string]: any } = {};  // Shared context for variables


    constructor() {
        this.initializeAILibraries();
    }

    private async initializeAILibraries() {
        try {
            this.aiLibraries['tf'] = require('@tensorflow/tfjs-node');
            this.aiLibraries['dfd'] = require('danfojs-node');
            // Add more AI-related libraries as needed
        } catch (error) {
            this.log('Error initializing AI libraries:', error);
        }
    }

    public getName() {
        return 'JavaScript';
    }

    private log(message: string, error?: any) {
        const logEntry = error ? `${message} ${error}` : message;
        console.log(logEntry);
        this.logs.push(logEntry);
    }

    async execute(code: string, env: NotebookEnvironment): Promise<any> {
        // Pre-execution syntax check
        try {
            acorn.parse(code, { ecmaVersion: 2020, allowAwaitOutsideFunction: true });
        } catch (syntaxError: any) {
            const lines = code.split('\n');
            const errorLine = syntaxError.loc.line;
            const contextLines = lines.slice(Math.max(0, errorLine - 3), errorLine + 2);
            const errorMessage = `
Syntax Error: ${syntaxError.message}
Near line ${errorLine}:
${contextLines.map((line, i) => `${errorLine - 2 + i}: ${line}`).join('\n')}
`;
            this.log(errorMessage);
            throw new Error(errorMessage);
        }

        const envVars = env.getEnvs();
        const outputLogs: any[] = [];

        // Override console to capture output
        const sandboxConsole = {
            log: (...args: any[]) => outputLogs.push(...args),
            error: (...args: any[]) => outputLogs.push('Error: ' + args.join(' ')),
            warn: (...args: any[]) => outputLogs.push('Warning: ' + args.join(' ')),
        };

        const sandbox = {
            console: sandboxConsole,
            setTimeout,
            clearTimeout,
            setInterval,
            clearInterval,
            setVariable: (name: string, value: any) => env.setVariable(name, value),
            getVariable: (name: string) => env.getVariable(name),
            writeFile: (filename: string, content: string) => env.writeFile(filename, content),
            readFile: (filename: string) => env.readFile(filename),
            require: (moduleName: string) => this.safeRequire(moduleName, env),
            global: this.sharedContext,
            process: {
                env: {
                    ...process.env,
                    ...envVars,
                    TF_CPP_MIN_LOG_LEVEL: '2', // Suppress TensorFlow info messages
                },
            },
        };

        const context = vm.createContext(sandbox);

        const start = process.hrtime();
        try {
            const wrappedCode = `
        (async () => {
            try {
                ${code}
            } catch (e) {
                if (e instanceof Error) {
                    e.stack = e.stack.replace(new RegExp('^.+?\\n'), '');
                    throw e;
                } else {
                    throw new Error(String(e));
                }
            }
        })();
    `;

            const script = new vm.Script(wrappedCode, { filename: 'user-code.js' });
            const result = await script.runInContext(context, {
                timeout: 30000,
                displayErrors: true,
            });

            const end = process.hrtime(start);
            const executionTime = (end[0] * 1000 + end[1] / 1e6).toFixed(3); // in milliseconds

            this.log(`Execution time: ${executionTime} ms`);

            // Handling output based on type
            if (Array.isArray(result) || typeof result === 'object') {
                return result; // Return objects and arrays directly (possibly as tables)
            } else if (typeof result === 'string') {
                return result; // Return strings as plain text
            } else {
                return outputLogs.join('\n'); // Combine console logs and return them as plain text
            }
        } catch (error: any) {
            this.log('Error executing JavaScript:', error);
            throw error;
        } finally {
            await this.saveLogs(env);
        }
    }




    async installPackage(packageName: string, env: NotebookEnvironment): Promise<void> {
        if (this.packageCache.has(packageName)) {
            this.log(`Package ${packageName} is already installed.`);
            return;
        }

        const notebookDir = env.directory;
        const command = `bun add ${packageName}`;

        try {
            this.log(`Installing package: ${packageName}`);
            execSync(command, { cwd: notebookDir });
            this.packageCache.add(packageName);
            this.log(`Successfully installed ${packageName}`);

            // Reinitialize AI libraries after installing new packages
            await this.initializeAILibraries();
        } catch (error) {
            this.log(`Failed to install package ${packageName}:`, error);
            throw error;
        }
    }

    private safeRequire(moduleName: string, env: NotebookEnvironment): any {
        if (moduleName === 'node-kernel') {
            return this.aiLibraries;
        }

        const notebookDir = env.directory;
        const modulePath = path.join(notebookDir, 'node_modules', moduleName);

        try {
            return require(modulePath);
        } catch (error) {
            this.log(`Failed to require module ${moduleName}:`, error);
            throw error;
        }
    }

    private async saveLogs(env: NotebookEnvironment) {
        const logFile = 'execution-log.txt';
        const logContent = this.logs.join('\n');
        await env.writeFile(logFile, logContent);
        this.log(`Logs saved to ${logFile}`);
    }
}
