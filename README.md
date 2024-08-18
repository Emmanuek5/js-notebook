# code-notebook

To install dependencies:

```bash
bun install
```

To run:

```ts
import { Notebook } from "./notebook";
import { JavaScriptKernel } from "./kernels/javascript";
import { TypeScriptKernel } from "./kernels/typescript";
import { ShellKernel } from "./kernels/shell";

async function main() {
  const notebook = new Notebook();
  await notebook.initialize();

  // Register kernels
  const jsKernel = new JavaScriptKernel();

  notebook.registerKernel("javascript", jsKernel);
  notebook.addEnvs({
    SOME_NOTEBOOK_SPECIFIC_VAR: "dwedewd",
  });

  const jsCellId = await notebook.createCell(
    "javascript",
    `
    const {tf} = require('node-kernel');

    // Create synthetic data for training
    const createSyntheticData = () => {
      const inputs = [];
      const labels = [];
      for (let i = 0; i < 1000; i++) {
        const x = Math.random();
        const y = x * 2 + Math.random() * 0.1;  // Linear relation with some noise
        inputs.push([x]);
        labels.push([y]);
      }
      return { inputs: tf.tensor2d(inputs), labels: tf.tensor2d(labels) };
    };

    // Define a simple linear model
    const createModel = () => {
      const model = tf.sequential();
      model.add(tf.layers.dense({ units: 1, inputShape: [1] }));
      model.compile({
        optimizer: 'sgd',
        loss: 'meanSquaredError'
      });
      return model;
    };

    // Train the model
    const trainModel = async (model, inputs, labels) => {
      await model.fit(inputs, labels, {
        epochs: 100,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            console.log(\`Epoch \${epoch + 1}: loss = \${logs.loss.toFixed(4)}\`);
          }
        }
      });
    };

    // Main execution
    (async () => {
      const { inputs, labels } = createSyntheticData();
      const model = createModel();

      console.log('Training model...');
      await trainModel(model, inputs, labels);

      // Test the model with a new input
      const testInput = tf.tensor2d([[0.5]]);
      const prediction = model.predict(testInput);
      prediction.print();
    })();
`
  );

  // Execute cells
  console.log("Executing JavaScript cell:");
  await notebook.executeCell(jsCellId);
}

main().catch(console.error);
```

```bash
bun run src/index.ts
```

This project was created using `bun init` in bun v1.1.20. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
