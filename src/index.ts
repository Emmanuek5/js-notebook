import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import { Notebook } from './notebook';
import { JavaScriptKernel } from './kernels/javascript';
import { ShellKernel } from './kernels/shell';
import path from 'path';

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static('public'));

// Create a new notebook instance
const notebook = new Notebook();

// Initialize the notebook environment
notebook.initialize().then(() => {
  // Register kernels
  notebook.registerKernel('javascript', new JavaScriptKernel());
  notebook.registerKernel('shell', new ShellKernel());

  // Load existing notebook if needed
  notebook.loadNotebook('my_notebook.json');
  console.log('Notebook environment initialized.');
}).catch(console.error);

// Routes
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


app.get("/notebook", (req: Request, res: Response) => {
  res.json(notebook.getNotebook());
});

// Get environment variables
app.get('/api/envs', async (req: Request, res: Response) => {
  try {
    const envs = notebook.getNotebook().environment;
    res.json({ envs });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get installed packages
app.get('/api/packages', async (req: Request, res: Response) => {
  try {
    const packages = notebook.getInstalledPackages();
    res.json({ packages });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get list of files
app.get('/api/files', async (req: Request, res: Response) => {
  try {
    const files = await notebook.listFiles();
    res.json({ files });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Save a file
app.post('/api/file', async (req: Request, res: Response) => {
  const { filename, content } = req.body;
  try {
    await notebook.saveFile(filename, content);
    res.json({ message: `File "${filename}" saved successfully.` });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Set environment variables
app.post('/api/envs', async (req: Request, res: Response) => {
  const envs = req.body;
  try {
    notebook.addEnvs(envs);
    res.json({ message: 'Environment variables updated successfully.' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get notebook metadata
app.get('/api/metadata', async (req: Request, res: Response) => {
  try {
    const metadata = {
      id: notebook.getId(),
      environment: notebook.getNotebook().environment,
    };
    res.json({ metadata });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update a cell's content
app.put('/api/cell', async (req: Request, res: Response) => {
  const { cellId, content } = req.body;
  try {
    await notebook.updateCell(cellId, content);
    res.json({ message: 'Cell updated successfully.' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create a new cell
app.post('/api/cell', async (req: Request, res: Response) => {
  const { kernelName, content } = req.body;
  try {
    const cellId = await notebook.createCell(kernelName, content);
    res.json({ cellId });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Execute a cell
app.post('/api/execute', async (req: Request, res: Response) => {
  const { cellId } = req.body;
  try {
    const result = await notebook.executeCell(cellId);
    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Save the notebook
app.post('/api/save', async (req: Request, res: Response) => {
  try {
    await notebook.saveNotebook('my_notebook.json');
    res.json({ message: 'Notebook saved successfully.' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.listen(port, () => {
  console.log(`Notebook server running at http://localhost:${port}`);
});
