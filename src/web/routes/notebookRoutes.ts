import { Router } from 'express';
import {
    getNotebook,
    getEnvironmentVars,
    getInstalledPackages,
    listFiles,
    saveFile,
    updateEnvs,
    getNotebookMetadata,
    updateCell,
    createCell,
    executeCell,
    saveNotebook,
    installPackages,
} from '../controllers/notebookController';

const router = Router();

router.get('/notebook', getNotebook);
router.get('/envs', getEnvironmentVars);
router.get('/packages', getInstalledPackages);
router.post('/packages', installPackages);
router.get('/files', listFiles);
router.post('/file', saveFile);
router.post('/envs', updateEnvs);
router.get('/metadata', getNotebookMetadata);
router.put('/cell', updateCell);
router.post('/cell', createCell);
router.post('/execute', executeCell);
router.post('/save', saveNotebook);

export { router as notebookRoutes };