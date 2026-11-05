import { loadEnv } from '../../config/env.js';
import { createDataSource } from '../data-source.js';
import { seed } from './seed.js';

const ds = createDataSource(loadEnv().DATABASE_URL);
await ds.initialize();
try {
  await seed(ds);
  console.log('Seed applied');
} finally {
  await ds.destroy();
}
