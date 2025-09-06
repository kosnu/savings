import path from 'path';
import fs from 'fs';

const featuresDir = path.join(process.cwd(), 'src/features');
const features = fs.readdirSync(featuresDir);

const generator = {
  description: 'Component Generator',
  prompts: [
    {
      type: 'input',
      name: 'outputPath',
      message: 'Where should the component be generated?',
    },
    {
      type: 'input',
      name: 'name',
      message: 'What is the name of the component?',
    },
  ],
  actions: (answers) => {
    const outputPath = answers?.outputPath ?? 'src/components';

    return [
      {
        type: 'add',
        path: `${outputPath}/{{properCase name}}/index.ts`,
        templateFile: 'generators/component/templates/index.ts.hbs',
      },
      {
        type: 'add',
        path: `${outputPath}/{{properCase name}}/{{properCase name}}.tsx`,
        templateFile: 'generators/component/templates/component.tsx.hbs',
      },
      {
        type: 'add',
        path: `${outputPath}/{{properCase name}}/{{properCase name}}.stories.tsx`,
        templateFile: 'generators/component/templates/component.stories.tsx.hbs',
      },
    ];
  },
};

export default generator;
