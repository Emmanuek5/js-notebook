// controllers/notebookController.ts
import { Request, Response } from 'express';
import { getNotebookInstance } from '../services/notebookService';

// Retrieve the entire notebook
export const getNotebook = (req: Request, res: Response) => {
    const notebook = getNotebookInstance();
    res.json(notebook.getNotebook());
};

// Get environment variables
export const getEnvironmentVars = (req: Request, res: Response) => {
    const notebook = getNotebookInstance();
    res.json({ envs: notebook.getNotebook().environment });
};

// Get installed packages
export const getInstalledPackages = async (req: Request, res: Response) => {
    try {
        const notebook = getNotebookInstance();
        const packages = notebook.getInstalledPackages();
        res.json({ packages });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
};


export const installPackages = (req: Request, res: Response) => {
    const { packages } = req.body;
    try {
        const notebook = getNotebookInstance();
        notebook.installPackage(packages);
        res.json({ message: 'Packages installed successfully.' });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
};

// Get list of files
export const listFiles = async (req: Request, res: Response) => {
    try {
        const notebook = getNotebookInstance();
        const files = await notebook.listFiles();
        res.json({ files });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
};

// Save a file
export const saveFile = async (req: Request, res: Response) => {
    const { filename, content } = req.body;
    try {
        const notebook = getNotebookInstance();
        await notebook.saveFile(filename, content);
        res.json({ message: `File "${filename}" saved successfully.` });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
};

// Update environment variables
export const updateEnvs = async (req: Request, res: Response) => {
    const envs = req.body;
    try {
        const notebook = getNotebookInstance();
        notebook.addEnvs(envs);
        res.json({ message: 'Environment variables updated successfully.' });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
};

// Get notebook metadata
export const getNotebookMetadata = (req: Request, res: Response) => {
    try {
        const notebook = getNotebookInstance();
        const metadata = {
            id: notebook.getId(),
            environment: notebook.getNotebook().environment,
        };
        res.json({ metadata });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
};

// Update a cell's content
export const updateCell = async (req: Request, res: Response) => {
    const { cellId, content } = req.body;
    try {
        const notebook = getNotebookInstance();
        await notebook.updateCell(cellId, content);
        res.json({ message: 'Cell updated successfully.' });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
};

// Create a new cell
export const createCell = async (req: Request, res: Response) => {
    const { kernelName, content } = req.body;
    try {
        const notebook = getNotebookInstance();
        const cellId = await notebook.createCell(kernelName, content);
        res.json({ cellId });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
};

// Execute a cell
export const executeCell = async (req: Request, res: Response) => {
    const { cellId } = req.body;
    try {
        const notebook = getNotebookInstance();
        const result = await notebook.executeCell(cellId);
        res.json({ result });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
};

// Save the notebook
export const saveNotebook = async (req: Request, res: Response) => {
    try {
        const notebook = getNotebookInstance();
        await notebook.saveNotebook('my_notebook.json');
        res.json({ message: 'Notebook saved successfully.' });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
};
