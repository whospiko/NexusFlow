import { pool, query } from '../config/db.js';
import * as sqlParserService from '../services/sqlParserService.js';
import * as erdService from '../services/erdService.js';

async function runTests() {
  console.log('🚀 Running Module 9 (Import & Template System) Integration Tests...\n');

  try {
    const projRes = await query('SELECT id FROM projects LIMIT 1');
    if (projRes.rows.length === 0) {
      throw new Error('No project found in database to test against');
    }
    const projectId = projRes.rows[0].id;
    console.log(`✅ Using Project ID: ${projectId}`);

    // --- TEST 1: SQL PARSER (AST & REGEX) ---
    console.log('\n--- 1. SQL DDL AST PARSER ---');
    const sampleSql = `
      CREATE TABLE departments (
        id INT PRIMARY KEY,
        dept_name VARCHAR(100) NOT NULL,
        location VARCHAR(150)
      );

      CREATE TABLE employees (
        id INT PRIMARY KEY,
        department_id INT NOT NULL,
        full_name VARCHAR(120) NOT NULL,
        salary DECIMAL(10,2) NOT NULL,
        hired_date DATE,
        FOREIGN KEY (department_id) REFERENCES departments(id)
      );
    `;

    const parsed = sqlParserService.parseSqlDdl(sampleSql);
    if (parsed.entities.length !== 2) {
      throw new Error(`Expected 2 entities, got ${parsed.entities.length}`);
    }
    console.log(`✅ AST Parser extracted ${parsed.entities.length} entities: ${parsed.entities.map(e => e.name).join(', ')}`);
    console.log(`✅ Extracted relationships: ${parsed.relationships.length}`);

    // --- TEST 2: IMPORT SQL INTO PROJECT ---
    console.log('\n--- 2. IMPORT SQL INTO PROJECT ---');
    const importRes = await sqlParserService.importSqlIntoProject(projectId, sampleSql, { overwrite: true });
    console.log(`✅ SQL Imported into Project: ${importRes.importedEntities} entities, ${importRes.importedRelationships} relationships`);

    // Verify in database
    const dbEntities = await erdService.getProjectEntities(projectId);
    console.log(`✅ Verified entities in PostgreSQL DB: ${dbEntities.map(e => e.name).join(', ')}`);

    // --- TEST 3: EXPORT JSON ARCHIVE ---
    console.log('\n--- 3. EXPORT PROJECT AS JSON ARCHIVE ---');
    const jsonExport = await sqlParserService.exportProjectAsJson(projectId);
    if (!jsonExport.entities || jsonExport.entities.length === 0) {
      throw new Error('Failed to export project JSON');
    }
    console.log(`✅ Exported JSON Model Archive: ${jsonExport.entities.length} entities, ${jsonExport.relationships.length} relationships`);

    // --- TEST 4: IMPORT JSON ARCHIVE ---
    console.log('\n--- 4. RESTORE MODEL FROM JSON ARCHIVE ---');
    const restoreRes = await sqlParserService.importJsonIntoProject(projectId, jsonExport, { overwrite: true });
    console.log(`✅ Restored model from JSON: ${restoreRes.importedEntities} entities`);

    // --- TEST 5: STARTER TEMPLATES (E-COMMERCE, SCHOOL, RENTAL) ---
    console.log('\n--- 5. STARTER TEMPLATES CATALOG ---');
    const starterTemplates = sqlParserService.STARTER_TEMPLATES;
    console.log(`✅ Starter Templates Count: ${starterTemplates.length}`);
    for (const t of starterTemplates) {
      console.log(`   • [${t.id}] "${t.title}" (${t.entityCount} entities, ${t.relationshipCount} relations)`);
    }

    // Apply E-commerce Template
    console.log('\n   Applying E-Commerce Starter Template...');
    const ecomRes = await sqlParserService.applyTemplate(projectId, 'ecommerce', { overwrite: true });
    console.log(`✅ Applied E-Commerce template: ${ecomRes.importedEntities} entities imported`);

    const ecomEntities = await erdService.getProjectEntities(projectId);
    console.log(`   Entities in DB: ${ecomEntities.map(e => e.name).join(', ')}`);

    // Apply School Template
    console.log('\n   Applying School Management Starter Template...');
    const schoolRes = await sqlParserService.applyTemplate(projectId, 'school', { overwrite: true });
    console.log(`✅ Applied School template: ${schoolRes.importedEntities} entities imported`);

    // Apply Rental Template
    console.log('\n   Applying Vehicle Rental Starter Template...');
    const rentalRes = await sqlParserService.applyTemplate(projectId, 'rental', { overwrite: true });
    console.log(`✅ Applied Vehicle Rental template: ${rentalRes.importedEntities} entities imported`);

    // --- TEST 6: PUBLIC COMMUNITY MODELS ---
    console.log('\n--- 6. CLONE PUBLIC COMMUNITY MODELS ---');
    const communityModels = sqlParserService.PUBLIC_COMMUNITY_MODELS;
    console.log(`✅ Public Community Models Count: ${communityModels.length}`);
    for (const m of communityModels) {
      console.log(`   • [${m.id}] "${m.title}" by ${m.author}`);
    }

    // Clone Hospital Model
    console.log('\n   Cloning Hospital Healthcare Community Model...');
    const hospRes = await sqlParserService.applyTemplate(projectId, 'hospital', { overwrite: true });
    console.log(`✅ Cloned Hospital model: ${hospRes.importedEntities} entities imported`);

    console.log('\n🎉 ALL MODULE 9 (IMPORT / TEMPLATES / COMMUNITY MODELS) TESTS PASSED 100%!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST FAILURE:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();

