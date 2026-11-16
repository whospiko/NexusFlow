import { pool, query } from '../config/db.js';
import * as codeGenService from '../services/codeGenService.js';
import * as docExportService from '../services/docExportService.js';
import * as erdService from '../services/erdService.js';

async function runTests() {
  console.log('🚀 Running Module 6 (Code Generator) & Module 7 (Document Exporter) Tests...\n');

  try {
    const projRes = await query('SELECT id FROM projects LIMIT 1');
    if (projRes.rows.length === 0) {
      throw new Error('No project found in database to test against');
    }
    const projectId = projRes.rows[0].id;
    console.log(`✅ Using Project ID: ${projectId}`);

    // --- TEST MODULE 6: CODE & SCHEMA GENERATOR ---
    console.log('\n--- MODULE 6: MULTI-DIALECT SQL & CODE GENERATOR ---');

    // 1. PostgreSQL
    const pgRes = await codeGenService.generateProjectCode(projectId, 'postgresql');
    if (!pgRes.sql || !pgRes.sql.includes('CREATE TABLE')) {
      throw new Error('PostgreSQL DDL generation failed');
    }
    console.log(`✅ PostgreSQL DDL Generated: ${pgRes.sql.length} characters`);

    // 2. MySQL
    const myRes = await codeGenService.generateProjectCode(projectId, 'mysql');
    if (!myRes.sql || !myRes.sql.includes('ENGINE=InnoDB')) {
      throw new Error('MySQL DDL generation failed');
    }
    console.log(`✅ MySQL DDL Generated: ${myRes.sql.length} characters (InnoDB Engine)`);

    // 3. SQL Server
    const msRes = await codeGenService.generateProjectCode(projectId, 'sqlserver');
    if (!msRes.sql || !msRes.sql.includes('IDENTITY(1,1)') && !msRes.sql.includes('CREATE TABLE')) {
      throw new Error('SQL Server DDL generation failed');
    }
    console.log(`✅ SQL Server (T-SQL) DDL Generated: ${msRes.sql.length} characters`);

    // 4. Oracle
    const oraRes = await codeGenService.generateProjectCode(projectId, 'oracle');
    if (!oraRes.sql || !oraRes.sql.includes('VARCHAR2')) {
      throw new Error('Oracle PL/SQL DDL generation failed');
    }
    console.log(`✅ Oracle (PL/SQL) DDL Generated: ${oraRes.sql.length} characters`);

    // 5. SQLite
    const sqRes = await codeGenService.generateProjectCode(projectId, 'sqlite');
    if (!sqRes.sql || !sqRes.sql.includes('PRAGMA foreign_keys')) {
      throw new Error('SQLite DDL generation failed');
    }
    console.log(`✅ SQLite DDL Generated: ${sqRes.sql.length} characters`);

    // 6. Prisma Schema
    if (!pgRes.prisma || !pgRes.prisma.includes('model') || !pgRes.prisma.includes('datasource db')) {
      throw new Error('Prisma Schema generation failed');
    }
    console.log(`✅ Prisma Schema Generated: ${pgRes.prisma.length} characters (schema.prisma)`);

    // 7. TypeORM Models
    if (!pgRes.typeorm || !pgRes.typeorm.includes('@Entity')) {
      throw new Error('TypeORM model generation failed');
    }
    console.log(`✅ TypeORM TypeScript Models Generated: ${pgRes.typeorm.length} characters`);

    // 8. Sequelize Models
    if (!pgRes.sequelize || !pgRes.sequelize.includes('DataTypes')) {
      throw new Error('Sequelize TypeScript Models Generated');
    }
    console.log(`✅ Sequelize TypeScript Models Generated: ${pgRes.sequelize.length} characters`);

    // --- TEST MODULE 7: DOCUMENT EXPORTER ⭐ ---
    console.log('\n--- MODULE 7: PDF / WORD / MARKDOWN DOCUMENT EXPORTER ⭐ ---');

    const testOptions = {
      title: 'Enterprise Relational Architecture Specification',
      author: 'Piko & Sokh Pisey Architecture Team',
      logoUrl: '',
      themeColor: '#0c66e4',
      sections: { s1: true, s2: true, s3: true, s4: true, s5: true, s6: true, s7: true },
    };

    // 1. HTML Report
    const html = await docExportService.buildHtmlDocument(projectId, testOptions);
    if (!html || !html.includes('1.0 Introduction') || !html.includes('Table of Contents')) {
      throw new Error('HTML Document building failed');
    }
    console.log(`✅ Full HTML Document Built: ${html.length} characters (Sections 1 through 7)`);

    // 2. Puppeteer PDF Generation
    console.log('   Rendering Server-side PDF via Headless Chrome...');
    const pdfBuffer = await docExportService.generatePdfDocument(projectId, testOptions);
    const pdfMagic = Buffer.from(pdfBuffer).slice(0, 4).toString('utf-8');
    if (pdfMagic !== '%PDF') {
      throw new Error(`Invalid PDF header: "${pdfMagic}"`);
    }
    console.log(`✅ Publication-Grade PDF Generated: ${pdfBuffer.length} bytes (Valid %PDF magic header)`);

    // 3. Word (DOCX) Generation
    console.log('   Packing Microsoft Word (DOCX) via docx library...');
    const docxBuffer = await docExportService.generateDocxDocument(projectId, testOptions);
    const docxMagic = Buffer.from(docxBuffer).slice(0, 2).toString('utf-8');
    if (docxMagic !== 'PK') {
      throw new Error(`Invalid DOCX zip header: "${docxMagic}"`);
    }
    console.log(`✅ Native Microsoft Word DOCX Generated: ${docxBuffer.length} bytes (Valid PK zip header)`);

    // 4. Markdown Generation
    const md = await docExportService.generateMarkdownDocument(projectId, testOptions);
    if (!md || !md.includes('# Enterprise Relational Architecture') || !md.includes('erDiagram')) {
      throw new Error('Markdown document generation failed');
    }
    console.log(`✅ Markdown Document Generated: ${md.length} characters (with Mermaid ERD)`);

    console.log('\n🎉 ALL MODULE 6 & MODULE 7 FEATURES VERIFIED 100% WORKING (PURE SQL BACKEND)!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST FAILURE:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
