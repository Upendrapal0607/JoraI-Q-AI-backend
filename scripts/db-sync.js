/**
 * JoraIQ.AI Database Switch & Sync Utility
 * Automatically adapts Prisma schema provider based on DATABASE_URL in .env
 * (Switches between SQLite for local zero-config and PostgreSQL for Supabase)
 */
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');

function getDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('DATABASE_URL=')) {
        const val = trimmed.substring('DATABASE_URL='.length).trim();
        return val.replace(/^["']|["']$/g, '');
      }
    }
  }
  return 'file:./dev.db';
}

function syncSchema() {
  const dbUrl = getDatabaseUrl();
  const isPostgres = dbUrl.startsWith('postgresql:') || dbUrl.startsWith('postgres:');
  const targetProvider = isPostgres ? 'postgresql' : 'sqlite';

  console.log(`[db-sync] DATABASE_URL detected: ${isPostgres ? 'PostgreSQL (Supabase)' : 'SQLite'}`);

  if (fs.existsSync(schemaPath)) {
    let schema = fs.readFileSync(schemaPath, 'utf8');
    const dsRegex = /datasource\s+db\s*\{[\s\S]*?\}/;
    const currentBlock = schema.match(dsRegex);

    const postgresBlock = `datasource db {\n  provider  = "postgresql"\n  url       = env("DATABASE_URL")\n  directUrl = env("DIRECT_URL")\n}`;
    const sqliteBlock = `datasource db {\n  provider = "sqlite"\n  url      = env("DATABASE_URL")\n}`;

    const targetBlock = isPostgres ? postgresBlock : sqliteBlock;

    if (currentBlock && currentBlock[0].trim() !== targetBlock.trim()) {
      console.log(`[db-sync] Updating datasource db block to '${targetProvider}'...`);
      schema = schema.replace(dsRegex, targetBlock);
      fs.writeFileSync(schemaPath, schema, 'utf8');
      console.log(`[db-sync] schema.prisma datasource block updated for '${targetProvider}'.`);
    } else {
      console.log(`[db-sync] schema.prisma datasource already configured for '${targetProvider}'.`);
    }
  }
}

syncSchema();
