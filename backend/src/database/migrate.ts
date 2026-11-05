import { loadEnv } from '../config/env.js';
import { createDataSource } from './data-source.js';

const direction = process.argv[2] === 'revert' ? 'revert' : 'run';
const ds = createDataSource(loadEnv().DATABASE_URL);

await ds.initialize();
try {
  if (direction === 'revert') {
    await ds.undoLastMigration();
    console.log('Reverted last migration');
  } else {
    const applied = await ds.runMigrations();
    console.log(`Applied ${applied.length} migration(s): ${applied.map((m) => m.name).join(', ')}`);
  }
} finally {
  await ds.destroy();
}
