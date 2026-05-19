const { migrate } = require('drizzle-orm/postgres-js/migrator');
const postgres = require('postgres');
const { drizzle } = require('drizzle-orm/postgres-js');

async function run() {
  try {
    const sql = postgres('postgresql://agentepro:agentepro_dev@localhost:5432/agentepro', { max: 1 });
    const db = drizzle(sql);
    await migrate(db, { migrationsFolder: './src/infrastructure/db/migrations' });
    console.log('Migration successful');
    process.exit(0);
  } catch (e) {
    console.error('MIGRATION_ERROR:', e);
    process.exit(1);
  }
}
run();
