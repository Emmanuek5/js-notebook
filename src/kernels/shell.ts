import { Kernel } from './kernel';
import { NotebookEnvironment } from '../notebook-environment';
import path from 'path';

export class ShellKernel implements Kernel {
    private forbiddenCommands: string[] = [
        // Add any commands you want to forbid for security reasons
    ];

    public getName() {
        return 'Shell';
    }

    async initialize(): Promise<void> {
        // Any initialization logic for the Shell kernel can go here
        return;
    }

    async shutdown(): Promise<void> {
        // Any shutdown logic for the Shell kernel can go here
        return;
    }

    async execute(command: string, env: NotebookEnvironment): Promise<{ output: string; error?: string }> {
        this.validateCommand(command);

        const notebookDir = env.directory;

        try {
            const proc = Bun.spawn(['sh', '-c', command], {
                stdout: 'pipe',
                stderr: 'pipe',
                cwd: notebookDir,
                env: {
                    ...process.env,
                    PATH: `${notebookDir}/node_modules/.bin:${process.env.PATH}`,
                },
            });

            const stdout = await new Response(proc.stdout).text();
            const stderr = await new Response(proc.stderr).text();

            const output = stdout.trim();
            const error = stderr.trim();

            if (await proc.exited && proc.exitCode !== 0) {
                // If the command fails, return the error instead of throwing it
                return { output, error: `Command failed with exit code ${proc.exitCode}.\n${error}` };
            }

            // If command was successful but there was an error message, return it too
            return { output, error: error ? error : undefined };
        } catch (error: any) {
            return { output: '', error: `Shell execution error: ${error.message}` };
        }
    }

    private validateCommand(command: string): void {
        const commandParts = command.split(/\s+/);
        const baseCommand = path.basename(commandParts[0]);

        if (this.forbiddenCommands.includes(baseCommand)) {
            throw new Error(`Command '${baseCommand}' is not allowed for security reasons.`);
        }

        // Additional security checks can be added here
    }

    async installPackage(packageName: string, env: NotebookEnvironment): Promise<void> {
        const result = await this.execute(`bun add ${packageName}`, env);
        if (result.error) {
            throw new Error(result.error);
        }
    }
}
