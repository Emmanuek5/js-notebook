import { Kernel } from './kernel';
import { NotebookEnvironment } from '@/notebook-environment';
import * as ts from 'typescript';
import { VM } from 'vm2';
import path from 'path';
import { execSync } from 'child_process';
import fs from 'fs/promises';

export class TypeScriptKernel implements Kernel {
    private compilerOptions: ts.CompilerOptions = {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.NodeNext,  // Changed from ESNext to NodeNext
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        lib: ["es2020", "dom"],  // Add this line to include necessary libraries
    };
    private forbiddenPatterns: RegExp[] = [
        /eval\s*\(/,
        /Function\s*\(/,
        /new\s+Function\s*\(/,
        /process\.env/,
        /require\s*\(\s*['"]child_process['"]\s*\)/,
        /fs\s*\.\s*(writeFile|unlink|rmdir|mkdir)/,
    ];

    public getName() { 
        return 'TypeScript';
    }
    async execute(code: string, env: NotebookEnvironment): Promise<any> {
        // Validate code content
        this.validateCodeContent(code);

        // Type checking
        const typeCheckResult = this.typeCheck(code);
        if (typeCheckResult.diagnostics.length > 0) {
            throw new Error(this.formatDiagnostics(typeCheckResult.diagnostics));
        }

        // Transpile the code
        const transpileOutput = ts.transpileModule(code, {
            compilerOptions: this.compilerOptions,
        });

        const sandbox = {
            console,
            setTimeout,
            clearTimeout,
            setInterval,
            clearInterval,
            setVariable: (name: string, value: any) => env.setVariable(name, value),
            getVariable: (name: string) => env.getVariable(name),
            writeFile: (filename: string, content: string) => env.writeFile(filename, content),
            readFile: (filename: string) => env.readFile(filename),
            require: (moduleName: string) => this.safeRequire(moduleName, env),
            import: (moduleName: string) => this.safeImport(moduleName, env),
        };

        const vm = new VM({
            timeout: 5000,
            sandbox,
        });

        try {
            const result = await vm.run(`
                (async () => {
                    ${transpileOutput.outputText}
                })();
            `);
            return result;
        } catch (error) {
            console.error('Error executing TypeScript:', error);
            throw error;
        }
    }

    private validateCodeContent(code: string): void {
        for (const pattern of this.forbiddenPatterns) {
            if (pattern.test(code)) {
                throw new Error(`Forbidden pattern detected: ${pattern}`);
            }
        }
    }

    private async safeRequire(moduleName: string, env: NotebookEnvironment): Promise<any> {
        const notebookDir = env.directory;
        const modulePath = path.join(notebookDir, 'node_modules', moduleName);

        try {
            await fs.access(modulePath);
            // You might want to add additional checks here for the module's content
            return require(modulePath);
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                throw new Error(`Module "${moduleName}" is not installed. Please install it first.`);
            }
            console.error(`Failed to require module ${moduleName}:`, error);
            throw error;
        }
    }

    private async safeImport(moduleName: string, env: NotebookEnvironment): Promise<any> {
        const notebookDir = env.directory;
        const modulePath = path.join(notebookDir, 'node_modules', moduleName);

        try {
            await fs.access(modulePath);
            return await import(modulePath);
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                console.log(`Module "${moduleName}" not found. Attempting to install...`);
                await this.installPackage(moduleName, env);
                return await import(modulePath);
            }
            console.error(`Failed to import module ${moduleName}:`, error);
            throw error;
        }
    }

    async installPackage(packageName: string, env: NotebookEnvironment): Promise<void> {
        const notebookDir = env.directory;
        const command = `bun add ${packageName}`;

        try {
            console.log(`Installing package: ${packageName}`);
            execSync(command, { cwd: notebookDir, stdio: 'inherit' });
            console.log(`Successfully installed ${packageName}`);
        } catch (error) {
            console.error(`Failed to install package ${packageName}:`, error);
            throw error;
        }
    }

    private typeCheck(code: string): { diagnostics: readonly ts.Diagnostic[] } {
        const fileName = 'input.ts';
        const host = ts.createCompilerHost(this.compilerOptions);
        host.getSourceFile = (name) =>
            name === fileName
                ? ts.createSourceFile(name, code, this.compilerOptions.target ?? ts.ScriptTarget.Latest)
                : undefined;

        const program = ts.createProgram([fileName], {
            ...this.compilerOptions,
            noEmit: true,
            allowJs: true,
            checkJs: true,
        }, host);
        const diagnostics = ts.getPreEmitDiagnostics(program);
        return { diagnostics };
    }

    private formatDiagnostics(diagnostics: readonly ts.Diagnostic[]): string {
        return ts.formatDiagnosticsWithColorAndContext(diagnostics, {
            getCurrentDirectory: () => '',
            getCanonicalFileName: (fileName) => fileName,
            getNewLine: () => '\n',
        });
    }
}