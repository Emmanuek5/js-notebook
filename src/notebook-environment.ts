import { mkdir, writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Kernel } from './kernels/kernel';

export class NotebookEnvironment {
    private variables: Record<string, any> = {};
    private envVars: Record<string, string> = {};
    readonly id: string;
    readonly directory: string;
    private htmlOutputs: string[] = [];

    constructor(baseDir: string) {
        this.id = uuidv4();
        this.directory = join(baseDir, this.id);
    }

    async initialize() {
        await mkdir(this.directory, { recursive: true });
    }

    setVariable(name: string, value: any) {
        this.variables[name] = value;
    }

    getVariable(name: string): any {
        return this.variables[name];
    }

    addEnvs(envs: Record<string, string>) {
        Object.assign(this.envVars, envs);
    }

    getEnvs(): Record<string, string> {
        return { ...this.envVars };
    }

    setEnvs(envs: Record<string, string>) {
        this.envVars = envs;
    }

    async writeFile(filename: string, content: string) {
        const filePath = join(this.directory, filename);
        await writeFile(filePath, content);
    }

    async readFile(filename: string): Promise<string> {
        const filePath = join(this.directory, filename);
        return await readFile(filePath, 'utf-8');
    }

    async displayHtml(html: string): Promise<void> {
        // Store the HTML content
        this.htmlOutputs.push(html);

        // Here, you would typically send this HTML to your frontend for display
        // For now, we'll just log it to the console
        console.log('HTML Output:', html);

        // You might want to write this to a file as well
        const outputFilename = `output_${this.htmlOutputs.length}.html`;
        await this.writeFile(outputFilename, html);
    }

    getHtmlOutputs(): string[] {
        return this.htmlOutputs;
    }
}