import { Notebook } from './notebook';
import { JavaScriptKernel } from './kernels/javascript';
import { ShellKernel } from './kernels/shell';

async function main() {
  const notebook = new Notebook();
  await notebook.initialize();

  // Register kernels
  const jsKernel = new JavaScriptKernel();
  notebook.registerKernel('javascript', jsKernel);
  notebook.addEnvs({
    SOME_NOTEBOOK_SPECIFIC_VAR: "dwedewd"
  });

  // Create cells
  const jsCellId = await notebook.createCell('javascript', `
global.myArray = [1, 2, 3];
console.log('This is a simple log.');
    `);

  const jsCell2 = await notebook.createCell('javascript', `
global.myArray; // This might render as a table
    `);

  const jsCell3 = await notebook.createCell('javascript', `
console.log('A simple string output.'); // This should render as plain text
    `);

  // Cell that creates and displays a table with danfo.js
  const danfoCellId = await notebook.createCell('javascript', `
const { dfd } = require('node-kernel'); // Assuming 'node-kernel' is the way you load your bundled libraries

// Create a simple DataFrame
const data = {
    'Name': ['Alice', 'Bob', 'Charlie'],
    'Age': [25, 30, 35],
    'City': ['New York', 'Los Angeles', 'Chicago']
};
const df = new dfd.DataFrame(data);

// Printing to console
console.log(df.toString()); // Depending on your implementation, this might not render as a visual table in the notebook

// Optionally, use df.plot if your environment supports it
// df.plot('table').render(); // Uncomment if plots can be handled
    `);

  // Execute cells
  console.log("Executing JavaScript cell:");
  await notebook.executeCell(jsCellId);
  await notebook.executeCell(jsCell2);
  await notebook.executeCell(jsCell3);
  await notebook.executeCell(danfoCellId);  // Execute the danfo.js cell
  await notebook.saveNotebook('my_notebook.json');
}

main().catch(console.error);
