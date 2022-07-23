import * as mochaIndex from './suite/index';

async function main() {
  try {
    mochaIndex.run();
  } catch (err) {
    console.error(err);
    console.error('Failed to run tests');
    process.exit(1);
  }
}

main();