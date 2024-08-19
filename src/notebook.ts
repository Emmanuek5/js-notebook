import { mkdir, writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Kernel } from './kernels/kernel';
import { NotebookEnvironment } from './notebook-environment';
import { Cell } from './cell';
import { execSync } from 'child_process';
import { performance } from 'perf_hooks';

type CellOutput = {
    type: 'text' | 'error' | 'html' | 'image' | 'table' | 'plot' | 'loader' | 'stream';
    content: any;
    metadata?: Record<string, any>;
};


export class Notebook {
    private cells: Cell[] = [];
    private kernels: Map<string, Kernel> = new Map();
    private environment: NotebookEnvironment;
    private id: string;
    private progressIndicator: ProgressIndicator;

    private installedPackages: Set<string> = new Set();

    constructor(baseDir: string = './notebooks') {
        this.id = uuidv4();
        this.progressIndicator = new ProgressIndicator();
        this.environment = new NotebookEnvironment(join(baseDir, this.id));
    }

    private log(message: string, icon: string = '🔹') {
        console.log(`\n${icon} ${message}\n`);
    }

    async initialize() {
        this.progressIndicator.start('Initializing notebook...');

        try {
            this.progressIndicator.updateStatus('Setting up environment...');
            await this.environment.initialize();

            this.progressIndicator.updateStatus('Initializing Bun project...');
            await this.initializeBunProject();

            this.progressIndicator.stop('Notebook initialized successfully');
        } catch (error) {
            this.progressIndicator.stop('Failed to initialize notebook');
            throw error;
        }
    }

    private async initializeBunProject() {
        const notebookDir = this.environment.directory;

        try {
            this.log(`Initializing Bun project in ${notebookDir}`, '📦');
            execSync('bun init -y', { cwd: notebookDir });

            const packageJsonPath = join(notebookDir, 'package.json');
            const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
            packageJson.name = `notebook-${this.id}`;
            await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

            this.log('Bun project initialized successfully', '✅');
        } catch (error) {
            this.log('Failed to initialize Bun project', '❌');
            console.error(error);
            throw error;
        }
    }

    registerKernel(name: string, kernel: Kernel) {
        this.kernels.set(name, kernel);
        this.log(`Registered kernel: ${name}`, '🔧');
    }

    async createCell(kernelName: string, content: string): Promise<string> {
        const kernel = this.kernels.get(kernelName);
        if (!kernel) {
            throw new Error(`Kernel "${kernelName}" not found`);
        }
        const cell = new Cell(content, kernel);
        this.cells.push(cell);
        this.log(`Created new cell with ID: ${cell.getId()}`, '📝');
        return cell.getId();
    }

    async executeCell(cellId: string): Promise<any> {
        const cell = this.cells.find(c => c.getId() === cellId);
        if (!cell) {
            throw new Error(`Cell with id "${cellId}" not found`);
        }

        this.progressIndicator.start(`Executing cell ${cellId}`);
        const startTime = performance.now(); // Start timing execution

        let result;
        try {
            result = await cell.execute(this.environment);
            const endTime = performance.now(); // End timing execution
            const executionTime = endTime - startTime;

            this.progressIndicator.stop(`Cell ${cellId} executed successfully`);

            // Save logs and usage data
            await this.saveExecutionData(cellId, executionTime);
        } catch (error) {
            this.progressIndicator.stop('Failed to execute cell');
            await this.saveExecutionData(cellId, 0, error); // Save logs with error if execution failed
            throw error;
        }

        return result;
    }

    private async saveExecutionData(cellId: string, executionTime: number, error: any = null) {
        const logs = [
            `Cell ID: ${cellId}`,
            `Execution Time: ${executionTime.toFixed(2)} ms`,
            error ? `Error: ${error.message}` : 'Execution: Success',
            error ? `Stack Trace: ${error.stack}` : '',
        ].join('\n');

        const logFileName = `${cellId}-execution-log.txt`;
        const logFilePath = join("logs", logFileName);

        await writeFile(logFilePath, logs);
        this.log(`Execution logs saved to ${logFilePath}`, '📄');
    }

    async installPackage(packageName: string): Promise<void> {
        if (this.installedPackages.has(packageName)) {
            this.log(`Package "${packageName}" is already installed`, '📦');
            return;
        }

        const notebookDir = this.environment.directory;
        const command = `bun add ${packageName}`;

        this.progressIndicator.start(`Installing package: ${packageName}`);
        try {
            execSync(command, { cwd: notebookDir });
            this.installedPackages.add(packageName);
            this.progressIndicator.stop(`Successfully installed ${packageName}`);

            for (const kernel of this.kernels.values()) {
                if ('updatePackages' in kernel && typeof kernel.updatePackages === 'function') {
                    await kernel.updatePackages(this.environment);
                }
            }
        } catch (error) {
            this.progressIndicator.stop(`Failed to install package ${packageName}`);
            console.error(error);
            throw error;
        }
    }

    async saveNotebook(filePath: string) {
        const notebookData = {
            id: this.id,
            metadata: {
                created: new Date().toISOString(),
            },
            cells: this.cells.map(cell => ({
                id: cell.getId(),
                kernel: cell.getKernelName(),
                content: cell.content,
                outputs: cell.getOutputs().map(output => ({
                    type: output.type,
                    content: output.content,
                    metadata: output.metadata,
                })),
            })),
        };

        await writeFile(filePath, JSON.stringify(notebookData, null, 2));
        this.log(`Notebook saved to ${filePath}`, '💾');
    }

    async loadNotebook(filePath: string) {
        const notebookData = JSON.parse(await readFile(filePath, 'utf-8'));

        this.id = notebookData.id;
        this.cells = notebookData.cells.map((cellData:any) => {
            const kernel = this.kernels.get(cellData.kernel);
            if (!kernel) {
                throw new Error(`Kernel "${cellData.kernel}" not found`);
            }

            const cell = new Cell(cellData.content, kernel, cellData.id);
            cellData.outputs.forEach((output: CellOutput) => cell.addOutput(output));

            return cell;
        });

        this.log(`Notebook loaded from ${filePath}`, '📂');
    }

    getInstalledPackages(): string[] {
        return Array.from(this.installedPackages);
    }

    addEnvs(envs: Record<string, string>) {
        this.environment.addEnvs(envs);
        this.log('Added new environment variables', '🔐');
    }

    async writeFile(filename: string, content: string) {
        await this.environment.writeFile(filename, content);
        this.log(`Wrote file: ${filename}`, '📄');
    }

    async readFile(filename: string): Promise<string> {
        const content = await this.environment.readFile(filename);
        this.log(`Read file: ${filename}`, '📖');
        return content;
    }

    getId(): string {
        return this.id;
    }
}

class ProgressIndicator {
    private spinner: string[] = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    private currentSpinnerIndex: number = 0;
    private interval: any;
    private currentStatus: string = '';

    start(initialStatus: string = 'Initializing...') {
        this.currentStatus = initialStatus;
        this.interval = setInterval(() => {
            process.stdout.write(`\r${this.spinner[this.currentSpinnerIndex]} ${this.currentStatus}`);
            this.currentSpinnerIndex = (this.currentSpinnerIndex + 1) % this.spinner.length;
        }, 100);
    }

    updateStatus(status: string) {
        this.currentStatus = status;
    }

    stop(finalMessage: string = 'Completed') {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        console.log(`\n✅ ${finalMessage}\n`);
    }
}
