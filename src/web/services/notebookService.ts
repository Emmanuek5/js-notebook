import { Notebook } from '../../notebook';
import { JavaScriptKernel } from '../../kernels/javascript';
import { ShellKernel } from '../../kernels/shell';

let notebook: Notebook;

export const initializeNotebook = async () => {
    notebook = new Notebook();
    await notebook.initialize();
    notebook.registerKernel('javascript', new JavaScriptKernel());
    notebook.registerKernel('shell', new ShellKernel());
    await notebook.loadNotebook('my_notebook.json');
};

export const getNotebookInstance = () => notebook;
