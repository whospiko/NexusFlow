import { pool, query } from '../config/db.js';

async function main() {
  try {
    const res = await query('SELECT count(*) FROM project_requirements');
    console.log('Requirements count from query:', res.rows[0].count);
    const linkRes = await query('SELECT count(*) FROM requirement_tasks');
    console.log('Requirement tasks count:', linkRes.rows[0].count);
  } catch (err) {
    console.error('Query error:', err);
  } finally {
    await pool.end();
  }
}

main();

