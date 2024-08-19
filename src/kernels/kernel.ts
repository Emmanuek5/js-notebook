import { NotebookEnvironment } from "../notebook-environment";



export interface Kernel {
    execute(code: string, env: NotebookEnvironment): Promise<any>;
    getName() : string;
}
