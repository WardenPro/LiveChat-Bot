import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { collectRuntimeModules, type RuntimeModuleInventoryOptions } from './moduleInventory';

const TEST_FILE_SUFFIXES = ['.test.ts', '.spec.ts'];

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

const createModuleTestCandidates = (modulePath: string): string[] => {
  const moduleWithoutExtension = modulePath.slice(0, -'.ts'.length);
  const moduleWithoutSourcePrefix = moduleWithoutExtension.startsWith('src/')
    ? moduleWithoutExtension.slice('src/'.length)
    : moduleWithoutExtension;

  const candidateBases = new Set<string>();
  candidateBases.add(`tests/unit/${moduleWithoutSourcePrefix}`);
  candidateBases.add(`tests/unit/${moduleWithoutExtension}`);

  if (moduleWithoutExtension.endsWith('/index')) {
    const withoutIndex = moduleWithoutExtension.slice(0, -'/index'.length);
    const withoutSourcePrefixIndex = withoutIndex.startsWith('src/')
      ? withoutIndex.slice('src/'.length)
      : withoutIndex;

    candidateBases.add(`tests/unit/${withoutIndex}`);
    candidateBases.add(`tests/unit/${withoutSourcePrefixIndex}`);
  }

  const candidates = [...candidateBases]
    .flatMap((basePath) => TEST_FILE_SUFFIXES.map((suffix) => `${basePath}${suffix}`))
    .sort((left, right) => comparePaths(left, right));

  return candidates;
};

export interface UnitTestMatrixCoveredModule {
  modulePath: string;
  testFiles: string[];
}

export interface UnitTestMatrixReport {
  status: 'pass' | 'fail';
  summary: {
    moduleCount: number;
    coveredCount: number;
    missingCount: number;
    testFileCount: number;
  };
  coveredModules: UnitTestMatrixCoveredModule[];
  missingModules: string[];
}

export interface UnitTestMatrixOptions extends RuntimeModuleInventoryOptions {
  testsDirectory?: string;
}

export const collectUnitTestFiles = (options: UnitTestMatrixOptions = {}): string[] => {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const testsDirectory = options.testsDirectory ?? 'tests/unit';
  const testsRoot = path.resolve(projectRoot, testsDirectory);

  const testFiles = walkFiles(testsRoot)
    .map((absolutePath) => toPosixPath(path.relative(projectRoot, absolutePath)))
    .filter((relativePath) => TEST_FILE_SUFFIXES.some((suffix) => relativePath.endsWith(suffix)));

  return testFiles.sort((left, right) => comparePaths(left, right));
};

export const createUnitTestMatrixReport = (options: UnitTestMatrixOptions = {}): UnitTestMatrixReport => {
  const runtimeModules = collectRuntimeModules(options);
  const availableTestFiles = collectUnitTestFiles(options);
  const availableTestFileSet = new Set(availableTestFiles);

  const coveredModules: UnitTestMatrixCoveredModule[] = [];
  const missingModules: string[] = [];

  for (const modulePath of runtimeModules) {
    const matchingTests = createModuleTestCandidates(modulePath).filter((candidatePath) =>
      availableTestFileSet.has(candidatePath),
    );

    if (matchingTests.length > 0) {
      coveredModules.push({
        modulePath,
        testFiles: matchingTests,
      });
      continue;
    }

    missingModules.push(modulePath);
  }

  const sortedCoveredModules = coveredModules.sort((left, right) =>
    comparePaths(left.modulePath, right.modulePath),
  );
  const sortedMissingModules = missingModules.sort((left, right) => comparePaths(left, right));

  return {
    status: sortedMissingModules.length > 0 ? 'fail' : 'pass',
    summary: {
      moduleCount: runtimeModules.length,
      coveredCount: sortedCoveredModules.length,
      missingCount: sortedMissingModules.length,
      testFileCount: availableTestFiles.length,
    },
    coveredModules: sortedCoveredModules,
    missingModules: sortedMissingModules,
  };
};

export const isUnitTestMatrixPassing = (report: UnitTestMatrixReport): boolean =>
  report.status === 'pass';
