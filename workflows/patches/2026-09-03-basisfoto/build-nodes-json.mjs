// Baut neue-nodes.json aus basisfoto-pruefen.js - damit der JS-Code nur an einer
// Stelle gepflegt wird. Aufruf:  node build-nodes-json.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const hier = dirname(fileURLToPath(import.meta.url));
const jsCode = readFileSync(join(hier, 'basisfoto-pruefen.js'), 'utf8');

const paste = {
  nodes: [
    {
      parameters: { jsCode },
      id: 'a1f0c2d4-6b3e-4a11-9c77-000000000001',
      name: 'Basisfoto pruefen',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [5904, 432]
    },
    {
      parameters: {
        operation: 'resize',
        dataPropertyName: 'basis',
        width: 1536,
        height: 1536,
        resizeOption: 'onlyIfLarger',
        options: { destinationKey: 'basis', format: 'png', quality: 100 }
      },
      id: 'a1f0c2d4-6b3e-4a11-9c77-000000000002',
      name: 'Basisfoto normalisieren',
      type: 'n8n-nodes-base.editImage',
      typeVersion: 1,
      position: [6064, 432]
    }
  ],
  connections: {
    'Basisfoto pruefen': {
      main: [[{ node: 'Basisfoto normalisieren', type: 'main', index: 0 }]]
    }
  },
  pinData: {}
};

writeFileSync(join(hier, 'neue-nodes.json'), JSON.stringify(paste, null, 2) + '\n');
console.log('neue-nodes.json geschrieben');
