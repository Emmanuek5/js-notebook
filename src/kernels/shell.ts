import { Kernel } from './kernel';
import { NotebookEnvironment } from '@/notebook-environment';
import path from 'path';

export class ShellKernel implements Kernel {
    private forbiddenCommands: string[] = [
        'rm', 'mv', 'cp', 'chmod', 'chown', 'sudo', 'su',
        'wget', 'curl', 'ping', 'nmap', 'nc', 'netcat'
    ];

    async execute(command: string, env: NotebookEnvironment): Promise<string> {
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

            const output = stdout + (stderr ? `\nError: ${stderr}` : '');

            if (await proc.exited && proc.exitCode !== 0) {
                throw new Error(`Command failed with exit code ${proc.exitCode}.\n${output}`);
            }

            return output.trim();
        } catch (error) {
            console.error('Error executing shell command:', error);
            throw error;
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
        await this.execute(`bun add ${packageName}`, env);
    }
}