import { createUnitTestMatrixReport, isUnitTestMatrixPassing } from './unitTestMatrix';

const report = createUnitTestMatrixReport({
  projectRoot: process.cwd(),
});

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

if (!isUnitTestMatrixPassing(report)) {
  process.exitCode = 1;
}
