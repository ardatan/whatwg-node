const fs = require('fs');
const path = require('path');

const packageJsonStr = fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8');
const packageJson = JSON.parse(packageJsonStr);

for (const devDep of Object.keys(packageJson.devDependencies)) {
  if (devDep.startsWith('@babel/')) {
    packageJson.devDependencies[devDep] = '^7';
  }
}

fs.writeFileSync(path.join(__dirname, 'package.json'), JSON.stringify(packageJson, null, 2));
