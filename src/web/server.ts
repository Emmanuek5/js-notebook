import express, { Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import helmet from 'helmet';
import compression from 'compression';
import { notebookRoutes } from './routes/notebookRoutes';
import { initializeNotebook } from './services/notebookService';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(compression());
app.use(bodyParser.json());
app.use(express.static('public'));

// Initialize Notebook Environment
initializeNotebook()
    .then(() => {
        console.log('Notebook environment initialized.');
    })
    .catch(console.error);

// Routes
app.use('/api', notebookRoutes);

// Serve main index file
app.get('/', (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Centralized error handling
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: err.message });
});

// Start server
app.listen(port, () => {
    console.log(`Notebook server running at http://localhost:${port}`);
});
