import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

export function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: 'bdd',
    color: true,
    timeout: 4000
  });

  const testsRoot = path.resolve(__dirname, '..');

  return new Promise((completedOK, errorsHappened) => {
    glob('**/**.test.js', {cwd: testsRoot }).then(files => {
      // Add files to the test suite
      files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));
      
      try {
        // Run the mocha test
        mocha.run(failures => {
          if (failures > 0) {
            errorsHappened(new Error(`${failures} tests failed.`));
          } else {
            completedOK();
          }
        });
      } catch (err) {
        errorsHappened(err);
      }
    });
  });
}
