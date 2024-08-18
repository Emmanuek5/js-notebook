import { Kernel } from './kernels/kernel';
import { NotebookEnvironment } from './notebook-environment';

type CellOutput = {
    type: 'text' | 'error' | 'html' | 'image' | 'table' | 'plot' | 'loader' | 'stream';
    content: any;
    metadata?: Record<string, any>;
};

export class Cell {
    private id: string;
    private outputs: CellOutput[] = [];

    constructor(
        public content: string,
        private kernel: Kernel,
        id?: string
    ) {
        this.id = id || crypto.randomUUID();
    }

    getId(): string {
        return this.id;
    }

    async execute(env: NotebookEnvironment): Promise<void> {
        this.clearOutputs();
        this.addOutput({ type: 'loader', content: 'Executing cell...' });

        try {
            const result = await this.kernel.execute(this.content, env);
            this.handleResult(result);
        } catch (error) {
            this.handleError(error);
        } finally {
            this.removeLoader();
        }
    }

    private handleResult(result: any): void {
        if (result === undefined) {
            return; // No output for undefined results
        }

        if (typeof result === 'string' || typeof result === 'number' || typeof result === 'boolean') {
            this.addOutput({ type: 'text', content: String(result) });
        } else if (result instanceof Error) {
            this.handleError(result);
        } else if (Array.isArray(result) || typeof result === 'object') {
            this.addOutput({ type: 'table', content: result });
        } else if (result instanceof Promise) {
            this.handleAsyncResult(result);
        } else {
            this.addOutput({ type: 'text', content: String(result) });
        }
    }

    private handleError(error: any): void {
        this.addOutput({
            type: 'error',
            content: error instanceof Error ? error.message : String(error),
            metadata: { stack: error instanceof Error ? error.stack : undefined }
        });
    }

    private handleAsyncResult(result: Promise<any>): void {
        this.addOutput({ type: 'loader', content: 'Processing async result...' });
        result.then(
            (value) => {
                this.removeLoader();
                this.handleResult(value);
            },
            (error) => {
                this.removeLoader();
                this.handleError(error);
            }
        );
    }

    private addOutput(output: CellOutput): void {
        this.outputs.push(output);
        this.renderOutput(output);
    }

    private renderOutput(output: CellOutput): void {
        // This method would be responsible for actually rendering the output
        // in the notebook interface. For now, we'll just log it to the console.

    }

    private clearOutputs(): void {
        this.outputs = [];
    }

    private removeLoader(): void {
        this.outputs = this.outputs.filter(output => output.type !== 'loader');

    }

    getOutputs(): CellOutput[] {
        return this.outputs;
    }
}

