import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const EXCLUDED_PREFIXES = ['src/architecture/', 'src/characterization/', 'src/typechecks/'];
const EXCLUDED_SUFFIXES = ['.d.ts', '.typecheck.ts'];

const toPosixPath = (value: string): string => value.split(path.sep).join('/');
const comparePaths = (left: string, right: string): number => (left === right ? 0 : left < right ? -1 : 1);

const walkFiles = (rootDirectory: string): string[] => {
  if (!existsSync(rootDirectory)) {
    return [];
  }

  const discoveredFiles: string[] = [];
  const directories: string[] = [rootDirectory];

  while (directories.length > 0) {
    const currentDirectory = directories.pop();

    if (!currentDirectory) {
      continue;
    }

    const entries = readdirSync(currentDirectory, { withFileTypes: true }).sort((left, right) =>
      comparePaths(left.name, right.name),
    );

    for (const entry of entries) {
      const absolutePath = path.join(currentDirectory, entry.name);

      if (entry.isDirectory()) {
        directories.push(absolutePath);
        continue;
      }

      if (entry.isFile()) {
        discoveredFiles.push(absolutePath);
      }
    }
  }

  return discoveredFiles.sort((left, right) => comparePaths(left, right));
};

export const isRuntimeModulePath = (modulePath: string): boolean => {
  if (!modulePath.startsWith('src/') || !modulePath.endsWith('.ts')) {
    return false;
  }

  if (EXCLUDED_PREFIXES.some((excludedPrefix) => modulePath.startsWith(excludedPrefix))) {
    return false;
  }

  if (EXCLUDED_SUFFIXES.some((excludedSuffix) => modulePath.endsWith(excludedSuffix))) {
    return false;
  }

  return true;
};

export interface RuntimeModuleInventoryOptions {
  projectRoot?: string;
  sourceDirectory?: string;
}

export const collectRuntimeModules = (options: RuntimeModuleInventoryOptions = {}): string[] => {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const sourceDirectory = options.sourceDirectory ?? 'src';
  const sourceRoot = path.resolve(projectRoot, sourceDirectory);

  const runtimeModules = walkFiles(sourceRoot)
    .map((absolutePath) => toPosixPath(path.relative(projectRoot, absolutePath)))
    .filter((relativePath) => isRuntimeModulePath(relativePath));

  return runtimeModules.sort((left, right) => comparePaths(left, right));
};
