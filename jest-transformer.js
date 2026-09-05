const { existsSync, readFileSync } = require('fs');
const { dirname, join, normalize, resolve } = require('path');
const ts = require('typescript');

const ROOT_DIR = __dirname;
const TSCONFIG = resolve(ROOT_DIR, 'tsconfig.json');
const { config: rawTsConfig } = ts.readConfigFile(TSCONFIG, ts.sys.readFile);
const { options: parsedCompilerOptions } = ts.parseJsonConfigFileContent(
  rawTsConfig,
  ts.sys,
  ROOT_DIR,
);

const baseCompilerOptions = {
  ...parsedCompilerOptions,
  allowJs: true,
  declaration: false,
  declarationMap: false,
  inlineSourceMap: true,
  inlineSources: true,
  noEmit: false,
  sourceMap: false,
};

const commonJsCompilerOptions = {
  ...baseCompilerOptions,
  module: ts.ModuleKind.CommonJS,
};

const esmCompilerOptions = {
  ...baseCompilerOptions,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
};

const packageTypeByDir = new Map();

function getPackageType(sourcePath) {
  let currentDir = dirname(sourcePath);

  while (true) {
    const cachedPackageType = packageTypeByDir.get(currentDir);
    if (cachedPackageType) {
      return cachedPackageType;
    }

    const packageJsonPath = join(currentDir, 'package.json');
    if (existsSync(packageJsonPath)) {
      const packageType =
        JSON.parse(readFileSync(packageJsonPath, 'utf8')).type === 'module' ? 'module' : 'commonjs';
      packageTypeByDir.set(currentDir, packageType);
      return packageType;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      return 'commonjs';
    }
    currentDir = parentDir;
  }
}

function getCompilerOptions(sourcePath) {
  const normalizedSourcePath = normalize(sourcePath);

  if (normalizedSourcePath.endsWith('.cjs')) {
    return commonJsCompilerOptions;
  }

  if (normalizedSourcePath.endsWith('.mjs')) {
    return esmCompilerOptions;
  }

  if (normalizedSourcePath.endsWith('.js') && getPackageType(normalizedSourcePath) === 'module') {
    return esmCompilerOptions;
  }

  return commonJsCompilerOptions;
}

module.exports = {
  process(sourceText, sourcePath) {
    const { outputText } = ts.transpileModule(sourceText, {
      compilerOptions: getCompilerOptions(sourcePath),
      fileName: sourcePath,
      reportDiagnostics: false,
    });

    return {
      code: outputText,
    };
  },
};
