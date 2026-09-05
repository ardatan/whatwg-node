const { resolve } = require('path');
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
  ignoreDeprecations: '6.0',
  inlineSourceMap: true,
  inlineSources: true,
  noEmit: false,
  sourceMap: false,
};

const commonJsCompilerOptions = {
  ...baseCompilerOptions,
  module: ts.ModuleKind.CommonJS,
  moduleResolution: ts.ModuleResolutionKind.Node10 ?? ts.ModuleResolutionKind.NodeJs,
};

const esmCompilerOptions = {
  ...baseCompilerOptions,
  module: ts.ModuleKind.ESNext,
};

function getCompilerOptions(sourcePath) {
  if (sourcePath.endsWith('.cjs')) {
    return commonJsCompilerOptions;
  }

  if (sourcePath.endsWith('.mjs') || sourcePath.includes('/node_modules/')) {
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
