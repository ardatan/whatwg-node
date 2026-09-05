const { resolve } = require('path');
const ts = require('@typescript/old');

const ROOT_DIR = __dirname;
const TSCONFIG = resolve(ROOT_DIR, 'tsconfig.json');
const { config: rawTsConfig } = ts.readConfigFile(TSCONFIG, ts.sys.readFile);
const { options: parsedCompilerOptions } = ts.parseJsonConfigFileContent(
  rawTsConfig,
  ts.sys,
  ROOT_DIR,
);

const compilerOptions = {
  ...parsedCompilerOptions,
  allowJs: true,
  declaration: false,
  declarationMap: false,
  ignoreDeprecations: '6.0',
  inlineSourceMap: true,
  inlineSources: true,
  module: ts.ModuleKind.CommonJS,
  moduleResolution: ts.ModuleResolutionKind.Node10 ?? ts.ModuleResolutionKind.NodeJs,
  noEmit: false,
  sourceMap: false,
};

const diagnosticsHost = {
  getCurrentDirectory: () => ROOT_DIR,
  getCanonicalFileName: fileName => fileName,
  getNewLine: () => '\n',
};

module.exports = {
  process(sourceText, sourcePath) {
    const { diagnostics, outputText } = ts.transpileModule(sourceText, {
      compilerOptions,
      fileName: sourcePath,
      reportDiagnostics: true,
    });

    if (diagnostics?.length) {
      throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, diagnosticsHost));
    }

    return {
      code: outputText,
    };
  },
};
