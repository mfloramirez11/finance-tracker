import { neon } from '@neondatabase/serverless'
import * as fs from 'fs'
import * as path from 'path'
import * as bcrypt from 'bcryptjs'

const sql = neon(process.env.DATABASE_URL!)

async function migrate() {
  console.log('Running migrations...')

  const migration1 = fs.readFileSync(path.join(__dirname, '../migrations/001_init.sql'), 'utf-8')
  const migration2 = fs.readFileSync(path.join(__dirname, '../migrations/002_seed.sql'), 'utf-8')

  await sql.transaction((tx) => [
    tx`${sql.unsafe(migration1)}`,
  ])
  console.log('✓ Schema created')

  await sql.transaction((tx) => [
    tx`${sql.unsafe(migration2)}`,
  ])
  console.log('✓ Seed data inserted')

  // Create default users
  const mannyHash = await bcrypt.hash('changeme123', 10)
  const celestiHash = await bcrypt.hash('changeme456', 10)

  await sql`
    INSERT INTO users (username, password_hash, role) VALUES
      ('manny', ${mannyHash}, 'admin'),
      ('celesti', ${celestiHash}, 'viewer')
    ON CONFLICT (username) DO NOTHING
  `
  console.log('✓ Default users created')
  console.log('  manny (admin) password: changeme123')
  console.log('  celesti (viewer) password: changeme456')
  console.log('')
  console.log('IMPORTANT: Change passwords immediately after first login!')
}

migrate().catch(console.error)
