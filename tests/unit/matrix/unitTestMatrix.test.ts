import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createUnitTestMatrixReport, isUnitTestMatrixPassing } from './unitTestMatrix';

const temporaryRoots: string[] = [];

const createFixtureProject = (files: Record<string, string>): string => {
  const projectRoot = mkdtempSync(path.join(tmpdir(), 'unit-test-matrix-'));
  temporaryRoots.push(projectRoot);

  for (const [relativePath, fileContent] of Object.entries(files)) {
    const absolutePath = path.join(projectRoot, relativePath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, fileContent);
  }

  return projectRoot;
};

afterEach(() => {
  for (const projectRoot of temporaryRoots.splice(0, temporaryRoots.length)) {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

describe('unitTestMatrix', () => {
  it('reports modules with matching tests as covered', () => {
    const projectRoot = createFixtureProject({
      'src/services/covered.ts': 'export const covered = true;\n',
      'src/characterization/ignored.characterization.ts': 'export const ignored = true;\n',
      'src/typechecks/ignored.typecheck.ts': 'export const ignored = true;\n',
      'src/types/module.d.ts': 'declare global {}\n',
      'tests/unit/services/covered.test.ts': 'import {} from "../../../src/services/covered";\n',
    });

    const report = createUnitTestMatrixReport({ projectRoot });

    expect(report.status).toBe('pass');
    expect(isUnitTestMatrixPassing(report)).toBe(true);
    expect(report.summary).toEqual({
      moduleCount: 1,
      coveredCount: 1,
      missingCount: 0,
      testFileCount: 1,
    });
    expect(report.coveredModules).toEqual([
      {
        modulePath: 'src/services/covered.ts',
        testFiles: ['tests/unit/services/covered.test.ts'],
      },
    ]);
    expect(report.missingModules).toEqual([]);
  });

  it('fails and prints missing module paths when no matching tests exist', () => {
    const projectRoot = createFixtureProject({
      'src/services/covered.ts': 'export const covered = true;\n',
      'src/services/missing.ts': 'export const missing = true;\n',
      'tests/unit/src/services/covered.test.ts': 'import {} from "../../../../src/services/covered";\n',
    });

    const report = createUnitTestMatrixReport({ projectRoot });

    expect(report.status).toBe('fail');
    expect(isUnitTestMatrixPassing(report)).toBe(false);
    expect(report.summary).toEqual({
      moduleCount: 2,
      coveredCount: 1,
      missingCount: 1,
      testFileCount: 1,
    });
    expect(report.missingModules).toEqual(['src/services/missing.ts']);
  });
});
