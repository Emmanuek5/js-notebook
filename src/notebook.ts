import { mkdir, writeFile, readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Kernel } from './kernels/kernel';
import { NotebookEnvironment } from './notebook-environment';
import { Cell } from './cell';
import { execSync } from 'child_process';
import { performance } from 'perf_hooks';
import si from 'systeminformation';

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


    async updateCell(cellId: string, newContent: string): Promise<void> {
        const cell = this.cells.find(c => c.getId() === cellId);
        if (!cell) {
            throw new Error(`Cell with id "${cellId}" not found`);
        }

        cell.setContent(newContent);  // Update the cell's content
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

    async listFiles(): Promise<string[]> {
        const files = await readdir(this.environment.directory);
        return files;
    }

    async saveFile(filename: string, content: string): Promise<void> {
        const filePath = join(this.environment.directory, filename);
        await writeFile(filePath, content);
        this.log(`File saved: ${filePath}`, '📄');
    }

    getNotebook() {
        return {
            id: this.id,
            cells: this.cells.map(cell => ({
                id: cell.getId(),
                kernelName: cell.getKernelName(),
                content: cell.content,
                outputs: cell.getOutputs()
            })),
            environment: this.environment.getEnvs()  // Assuming getEnvs returns current environment settings
        }
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

        // Start performance monitoring
        const startMetrics = await this.collectPerformanceMetrics();

        this.progressIndicator.start(`Executing cell ${cellId}`);
        const startTime = performance.now();

        try {
            const result = await cell.execute(this.environment);
            const endTime = performance.now();
            const endMetrics = await this.collectPerformanceMetrics();  // Collect metrics after execution

            // Calculate execution time and log performance
            const executionTime = endTime - startTime;
            this.log(`Execution time for cell ${cellId}: ${executionTime.toFixed(2)} ms`);


            // Store performance data in the cell
            cell.setPerformanceData({
                startTime,
                endTime,
                executionTime,
                startMetrics,
                endMetrics,
            });

            this.progressIndicator.stop(`Cell ${cellId} executed successfully`);
            return cell.getOutputs();
        } catch (error) {
            this.progressIndicator.stop('Failed to execute cell');
            throw error;
        }
    }
    async collectPerformanceMetrics() {
        // This function collects CPU, Memory and Disk usage
        const cpuUsage = await si.currentLoad();
        const memoryUsage = await si.mem();
        const diskUsage = await si.fsSize();
        return {
            cpuLoad: cpuUsage.currentLoad,
            usedMemory: memoryUsage.used,
            totalMemory: memoryUsage.total,
            diskInfo: diskUsage.map(disk => ({
                fs: disk.fs,
                type: disk.type,
                used: disk.used,
                size: disk.size
            }))
        };
    }

    private async logPerformanceData(cellId: string, startTime: number, endTime: number, startMetrics: any, endMetrics: any) {
        const executionTime = endTime - startTime;
        const performanceData = {
            cellId,
            executionTime,
            startMetrics,
            endMetrics,
            timestamp: new Date().toISOString(),
        };
        console.log(`Performance data: ${JSON.stringify(performanceData)}`);
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

    async saveState(filePath: string) {
        const stateData = {
            id: this.id,
            cells: this.cells.map(cell => ({
                id: cell.getId(),
                kernelName: cell.getKernelName(),
                content: cell.content,
                outputs: cell.getOutputs()
            })),
            environment: this.environment.getEnvs()  // Assuming getEnvs returns current environment settings
        };
        await writeFile(filePath, JSON.stringify(stateData, null, 2));
        this.log('Notebook state saved to ' + filePath);
    }

    async loadState(filePath: string) {
        const stateData = JSON.parse(await readFile(filePath, 'utf-8'));
        this.id = stateData.id;
        this.cells = stateData.cells.map((cellData: any) => {
            const kernel = this.kernels.get(cellData.kernelName);
            if (!kernel) {
                throw new Error(`Kernel "${cellData.kernelName}" not found`);
            }
            return new Cell(cellData.content, kernel, cellData.id);
        });
        this.environment.setEnvs(stateData.environment);  // Assuming setEnvs sets environment variables
        this.log('Notebook state loaded from ' + filePath);
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
            installedPackages: Array.from(this.installedPackages) // Include installed packages
        };

        await writeFile(filePath, JSON.stringify(notebookData, null, 2));
        this.log(`Notebook saved to ${filePath}`, '💾');
    }

    async loadNotebook(filePath: string) {
        const notebookData = JSON.parse(await readFile(filePath, 'utf-8'));

        this.id = notebookData.id;
        this.installedPackages = new Set(notebookData.installedPackages || []); // Load installed packages

        this.cells = notebookData.cells.map((cellData: any) => {
            const kernel = this.kernels.get(cellData.kernel.toLowerCase());
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
