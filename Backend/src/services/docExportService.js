import fs from 'fs';
import puppeteer from 'puppeteer-core';
import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  WidthType,
  Header,
  Footer,
  PageNumber,
  Packer,
  ShadingType,
} from 'docx';
import { getProjectEntities, getProjectRelationships, computeDenormalizedSchema } from './erdService.js';
import { query } from '../config/db.js';

// Auto-detect system browser for PDF rendering
function getSystemBrowserPath() {
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * 1. HTML REPORT BUILDER (Tailwind-compatible printable styles for PDF & Preview)
 */
export async function buildHtmlDocument(projectId, options = {}) {
  const {
    title = 'Database Design & Relational Modeling Specification',
    author = 'Software Architecture Team',
    logoUrl = '',
    themeColor = '#0c66e4',
    diagramSvg = '',
    sections = {
      s1: true, // Introduction & Methodology
      s2: true, // Entity Sets
      s3: true, // Attribute Tables
      s4: true, // Relationships & Cardinality
      s5: true, // ER Diagram
      s6: true, // Relational Schema
      s7: true, // De-normalization Summary
    },
  } = options;

  // Fetch Project Metadata
  const projRes = await query('SELECT * FROM projects WHERE id = $1', [projectId]);
  const project = projRes.rows[0] || { name: 'Software Project', description: '' };

  const entities = await getProjectEntities(projectId);
  const relationships = await getProjectRelationships(projectId);
  const denormData = await computeDenormalizedSchema(projectId);

  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title} - ${project.name}</title>
  <style>
    @page {
      size: A4;
      margin: 20mm 15mm 20mm 15mm;
      @bottom-center {
        content: counter(page);
      }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1a202c;
      background: #ffffff;
      line-height: 1.5;
      font-size: 11pt;
      margin: 0;
      padding: 0;
    }
    .page-break {
      page-break-before: always;
    }
    .no-break {
      page-break-inside: avoid;
    }
    header.doc-header {
      border-bottom: 2px solid ${themeColor};
      padding-bottom: 6px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      font-size: 8.5pt;
      color: #718096;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .cover-container {
      min-height: 90vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 40px 0;
      page-break-after: always;
    }
    .cover-top {
      border-left: 6px solid ${themeColor};
      padding-left: 20px;
    }
    .cover-title {
      font-size: 26pt;
      font-weight: 800;
      color: #1a202c;
      line-height: 1.2;
      margin: 0 0 10px 0;
    }
    .cover-subtitle {
      font-size: 14pt;
      color: ${themeColor};
      font-weight: 600;
      margin: 0 0 15px 0;
    }
    .cover-desc {
      font-size: 11pt;
      color: #4a5568;
      max-width: 600px;
    }
    .cover-meta {
      background: #f7fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 20px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      font-size: 10pt;
    }
    .meta-item strong {
      display: block;
      color: #718096;
      font-size: 8.5pt;
      text-transform: uppercase;
    }
    h1.sec-title {
      font-size: 16pt;
      font-weight: 700;
      color: #1a202c;
      border-bottom: 1.5px solid #e2e8f0;
      padding-bottom: 6px;
      margin-top: 30px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    h2.sub-title {
      font-size: 12pt;
      font-weight: 700;
      color: ${themeColor};
      margin-top: 20px;
      margin-bottom: 8px;
    }
    p {
      margin: 0 0 12px 0;
      color: #2d3748;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 9.5pt;
    }
    table.data-table th {
      background: #edf2f7;
      color: #2d3748;
      font-weight: 700;
      text-align: left;
      padding: 8px 10px;
      border: 1px solid #cbd5e0;
    }
    table.data-table td {
      padding: 6px 10px;
      border: 1px solid #cbd5e0;
      color: #2d3748;
    }
    table.data-table tr:nth-child(even) td {
      background: #f7fafc;
    }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 8pt;
      font-weight: bold;
      font-family: monospace;
    }
    .badge-pk { background: #feebc8; color: #7b341e; border: 1px solid #fbd38d; }
    .badge-fk { background: #bee3f8; color: #2c5282; border: 1px solid #90cdf4; }
    .badge-comp { background: #e9d8fd; color: #553c9a; border: 1px solid #d6bcfa; }
    .badge-weak { background: #fed7e2; color: #97266d; }
    .badge-strong { background: #c6f6d5; color: #22543d; }
    .toc-item {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px dotted #cbd5e0;
      padding: 6px 0;
      font-size: 10pt;
    }
    .diagram-container {
      background: #f7fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      margin: 20px 0;
      overflow: hidden;
    }
  </style>
</head>
<body>

  <!-- Cover Page -->
  <div class="cover-container">
    <div class="cover-top">
      ${logoUrl ? `<img src="${logoUrl}" style="max-height: 60px; margin-bottom: 25px;" alt="Logo" />` : ''}
      <h1 class="cover-title">${title}</h1>
      <div class="cover-subtitle">Step 2: System Analysis & Relational Database Design</div>
      <p class="cover-desc">
        Comprehensive architectural specification covering normalized entity sets, relational constraints, visual ERD diagrams, and de-normalization trade-offs for <strong>${project.name}</strong>.
      </p>
    </div>

    <div class="cover-meta">
      <div class="meta-item">
        <strong>Target Project</strong>
        <span>${project.name}</span>
      </div>
      <div class="meta-item">
        <strong>Author / Architect</strong>
        <span>${author}</span>
      </div>
      <div class="meta-item">
        <strong>Generation Date</strong>
        <span>${currentDate}</span>
      </div>
      <div class="meta-item">
        <strong>Database Engine</strong>
        <span>PostgreSQL Relational DB (Raw SQL)</span>
      </div>
    </div>
  </div>

  <!-- Running Header -->
  <header class="doc-header">
    <span>Step 2: System Analysis - Database Design Document</span>
    <span>Project: ${project.name}</span>
  </header>

  <!-- Auto Table of Contents -->
  <div class="no-break" style="margin-bottom: 30px;">
    <h1 class="sec-title" style="margin-top: 0;">Table of Contents</h1>
    ${sections.s1 ? '<div class="toc-item"><span>1.0 Introduction & Relational Methodology</span><span>Page 2</span></div>' : ''}
    ${sections.s2 ? '<div class="toc-item"><span>2.0 Entity Sets & Categorization</span><span>Page 2</span></div>' : ''}
    ${sections.s3 ? '<div class="toc-item"><span>3.0 Entity Attribute Tables (Image 2/3 Format)</span><span>Page 3</span></div>' : ''}
    ${sections.s4 ? '<div class="toc-item"><span>4.0 Entity Relationships & Logic (Image 4 Format)</span><span>Page 4</span></div>' : ''}
    ${sections.s5 ? '<div class="toc-item"><span>5.0 Visual Entity-Relationship Diagram (ERD)</span><span>Page 5</span></div>' : ''}
    ${sections.s6 ? '<div class="toc-item"><span>6.0 Relational Table Schema (Image 7 Format)</span><span>Page 6</span></div>' : ''}
    ${sections.s7 ? '<div class="toc-item"><span>7.0 De-normalization Analysis & Performance Summary</span><span>Page 7</span></div>' : ''}
  </div>

  <!-- SECTION 1: Introduction & Methodology -->
  ${sections.s1 ? `
  <div class="no-break">
    <h1 class="sec-title">1.0 Introduction & Relational Methodology</h1>
    <p>
      This database design document defines the logical data architecture for <strong>${project.name}</strong>. 
      The data modeling process follows standard software engineering principles based on the Entity-Relationship (ER) model 
      and Codd's Relational Normalization rules.
    </p>
    <p>
      The architecture proceeds through three key phases:
    </p>
    <ul>
      <li><strong>Conceptual Modeling:</strong> Identification of Strong and Weak Entity sets, business domain bounds, and attributes.</li>
      <li><strong>Logical Modeling:</strong> Derivation of foreign keys, composite primary keys, cardinality constraints (1:1, 1:M, M:N), and identifying relationships.</li>
      <li><strong>Relational Normalization & Optimization:</strong> Verification of 1NF, 2NF, and 3NF integrity rules, balanced against selective de-normalization for read-heavy operations.</li>
    </ul>
  </div>
  ` : ''}

  <!-- SECTION 2: Entity Sets -->
  ${sections.s2 ? `
  <div class="no-break">
    <h1 class="sec-title">2.0 Entity Sets & Categorization</h1>
    <p>The system defines <strong>${entities.length}</strong> core entities categorized into Strong and Weak entity sets:</p>

    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 25%;">Entity Name</th>
          <th style="width: 15%;">Type</th>
          <th style="width: 20%;">Identifying Parent</th>
          <th style="width: 40%;">Description</th>
        </tr>
      </thead>
      <tbody>
        ${entities.map((e) => {
          const parent = entities.find((p) => p.id === e.parent_entity_id);
          return `
            <tr>
              <td><strong>${e.name}</strong></td>
              <td><span class="badge ${e.type === 'Weak' ? 'badge-weak' : 'badge-strong'}">${e.type}</span></td>
              <td>${parent ? parent.name : '— (Independent)'}</td>
              <td>${e.description || 'Standard entity record'}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

  <!-- SECTION 3: Attribute Tables (Image 2/3 Format) -->
  ${sections.s3 ? `
  <div class="page-break"></div>
  <div>
    <h1 class="sec-title">3.0 Entity Attribute Tables (Image 2/3 Format)</h1>
    <p>Detailed specification of columns, primary keys, foreign keys, nullability, and descriptions per entity:</p>

    ${entities.map((ent) => `
      <div class="no-break" style="margin-bottom: 24px;">
        <h2 class="sub-title">Entity: ${ent.name} (${ent.type})</h2>
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 28%;">Attribute</th>
              <th style="width: 16%;">Key Type</th>
              <th style="width: 16%;">Data Type</th>
              <th style="width: 12%;">Nullable</th>
              <th style="width: 28%;">Description / References</th>
            </tr>
          </thead>
          <tbody>
            ${(ent.attributes || []).map((a) => {
              let keyBadge = 'Normal';
              if (a.keyType === 'PK') keyBadge = '<span class="badge badge-pk">PK</span>';
              else if (a.keyType === 'FK') keyBadge = '<span class="badge badge-fk">FK</span>';
              else if (a.keyType === 'Composite') keyBadge = '<span class="badge badge-comp">Composite PK</span>';

              return `
                <tr>
                  <td><strong>${a.name}</strong></td>
                  <td>${keyBadge}</td>
                  <td><code>${a.dataType}</code></td>
                  <td>${a.isNullable ? 'Yes' : 'No'}</td>
                  <td>${a.description || (a.keyType === 'FK' ? 'Foreign key constraint' : '—')}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `).join('')}
  </div>
  ` : ''}

  <!-- SECTION 4: Relationships (Image 4 Format) -->
  ${sections.s4 ? `
  <div class="page-break"></div>
  <div class="no-break">
    <h1 class="sec-title">4.0 Entity Relationships & Logic (Image 4 Format)</h1>
    <p>Relational associations, cardinality ratios, and bidirectional semantics across entity sets:</p>

    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 32%;">Relationship Statement</th>
          <th style="width: 12%; text-align: center;">Cardinality</th>
          <th style="width: 38%;">Bidirectional Semantics</th>
          <th style="width: 18%;">Cascade Rule</th>
        </tr>
      </thead>
      <tbody>
        ${relationships.map((rel) => `
          <tr>
            <td>
              <strong>[${rel.source_entity_name}]</strong> is related to <strong>[${rel.target_entity_name}]</strong>
              <div style="font-size: 8.5pt; color: #718096; margin-top: 2px;">Verb: "${rel.name || 'relates to'}"</div>
            </td>
            <td style="text-align: center;"><strong>${rel.cardinality}</strong></td>
            <td style="font-size: 8.5pt;">
              <div>(a) ${rel.bidirectional?.forward}</div>
              <div>(b) ${rel.bidirectional?.reverse}</div>
            </td>
            <td><code>ON DELETE ${rel.on_delete || 'CASCADE'}</code></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

  <!-- SECTION 5: Visual ER Diagram -->
  ${sections.s5 ? `
  <div class="page-break"></div>
  <div class="no-break">
    <h1 class="sec-title">5.0 Visual Entity-Relationship Diagram (ERD)</h1>
    <p>Visual schema representation rendered using Chen notation / Crow's foot layout:</p>

    <div class="diagram-container">
      ${diagramSvg ? diagramSvg : `
        <div style="padding: 40px; color: #718096; font-style: italic;">
          [Interactive ER Diagram rendered directly from React Flow Canvas]
        </div>
      `}
    </div>
  </div>
  ` : ''}

  <!-- SECTION 6: Table Schema (Image 7 Format) -->
  ${sections.s6 ? `
  <div class="page-break"></div>
  <div class="no-break">
    <h1 class="sec-title">6.0 Relational Table Schema (Image 7 Format)</h1>
    <p>Normalized 3NF relational schema tables showing primary key and foreign key column mappings:</p>

    ${entities.map((ent) => `
      <div style="margin-bottom: 16px; border: 1px solid #cbd5e0; border-radius: 6px; overflow: hidden;">
        <div style="background: #edf2f7; padding: 6px 12px; font-weight: bold; font-size: 10pt; color: #2d3748; border-bottom: 1px solid #cbd5e0;">
          TABLE: ${ent.name.toUpperCase()} (${ent.type})
        </div>
        <div style="padding: 10px; font-family: monospace; font-size: 9pt; background: #fafafa;">
          ${(ent.attributes || []).map((a) => {
            const isPk = a.keyType === 'PK' || a.keyType === 'Composite';
            const isFk = a.keyType === 'FK';
            const marker = isPk ? '🔑 PK' : isFk ? '🔗 FK' : '  ';
            return `<div>${marker.padEnd(6)} <strong>${a.name}</strong> : ${a.dataType} ${a.isNullable ? '(NULL)' : '(NOT NULL)'}</div>`;
          }).join('')}
        </div>
      </div>
    `).join('')}
  </div>
  ` : ''}

  <!-- SECTION 7: De-normalization Summary -->
  ${sections.s7 ? `
  <div class="page-break"></div>
  <div class="no-break">
    <h1 class="sec-title">7.0 De-normalization Analysis & Performance Summary</h1>
    <p>
      Selective de-normalization analysis comparing the fully normalized 3NF schema against flattened reporting tables 
      designed to eliminate expensive JOIN operations in high-throughput query environments.
    </p>

    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 25%;">Target Table</th>
          <th style="width: 25%;">Absorbed Parents</th>
          <th style="width: 50%;">Inherited Descriptive Columns</th>
        </tr>
      </thead>
      <tbody>
        ${denormData.denormalizedTables.filter((t) => t.isDenormalized).map((t) => {
          const inherited = t.attributes.filter((a) => a.origin === 'inherited').map((a) => a.name).join(', ');
          return `
            <tr>
              <td><strong>${t.name}</strong></td>
              <td>${t.absorbedParents.join(', ') || '—'}</td>
              <td style="font-size: 9pt; font-family: monospace;">${inherited || 'None'}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

</body>
</html>
  `;
}

/**
 * 2. PDF GENERATION VIA PUPPETEER (Headless Chrome)
 */
export async function generatePdfDocument(projectId, options = {}) {
  const browserPath = getSystemBrowserPath();
  if (!browserPath) {
    throw new Error('System browser (Chrome/Edge) not found on host for server-side PDF export');
  }

  const html = await buildHtmlDocument(projectId, options);

  const browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-web-security',
    ],
  });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(15000);

    try {
      await page.setContent(html, { waitUntil: 'load', timeout: 12000 });
    } catch {
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 8000 });
    }

    const pdfUint8 = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '15mm',
        right: '15mm',
        bottom: '15mm',
        left: '15mm',
      },
    });

    return Buffer.from(pdfUint8);
  } finally {
    await browser.close();
  }
}

/**
 * 3. WORD (DOCX) EXPORT VIA `docx` LIBRARY
 */
export async function generateDocxDocument(projectId, options = {}) {
  const {
    title = 'Database Design & Relational Modeling Specification',
    author = 'Software Architecture Team',
    sections = { s1: true, s2: true, s3: true, s4: true, s5: true, s6: true, s7: true },
  } = options;

  const projRes = await query('SELECT * FROM projects WHERE id = $1', [projectId]);
  const project = projRes.rows[0] || { name: 'Software Project' };
  const entities = await getProjectEntities(projectId);
  const relationships = await getProjectRelationships(projectId);
  const denormData = await computeDenormalizedSchema(projectId);

  const docChildren = [];

  // Cover Page
  docChildren.push(
    new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE,
      spacing: { before: 2000, after: 300 },
    }),
    new Paragraph({
      text: `Step 2: System Analysis - ${project.name}`,
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 600 },
    }),
    new Paragraph({
      text: `Author: ${author}  |  Date: ${new Date().toLocaleDateString()}`,
      spacing: { after: 2000 },
    }),
    new Paragraph({
      text: '',
      pageBreakBefore: true,
    })
  );

  // Section 1: Intro
  if (sections.s1) {
    docChildren.push(
      new Paragraph({
        text: '1.0 Introduction & Relational Methodology',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      }),
      new Paragraph({
        text: `This document outlines the relational database architecture for ${project.name}, rigorously complying with standard 1NF, 2NF, and 3NF normalization rules while documenting trade-offs for high-performance reporting.`,
        spacing: { after: 300 },
      })
    );
  }

  // Section 2: Entities
  if (sections.s2) {
    docChildren.push(
      new Paragraph({
        text: '2.0 Entity Sets & Classification',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );

    const entityRows = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: 'Entity Name', style: 'strong' })] }),
          new TableCell({ children: [new Paragraph({ text: 'Type', style: 'strong' })] }),
          new TableCell({ children: [new Paragraph({ text: 'Description', style: 'strong' })] }),
        ],
      }),
    ];

    for (const e of entities) {
      entityRows.push(
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(e.name)] }),
            new TableCell({ children: [new Paragraph(e.type)] }),
            new TableCell({ children: [new Paragraph(e.description || 'Standard Entity')] }),
          ],
        })
      );
    }

    docChildren.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: entityRows,
      }),
      new Paragraph({ text: '', spacing: { after: 300 } })
    );
  }

  // Section 3: Attribute Tables
  if (sections.s3) {
    docChildren.push(
      new Paragraph({
        text: '3.0 Attribute Tables (Image 2/3 Format)',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );

    for (const ent of entities) {
      docChildren.push(
        new Paragraph({
          text: `Entity: ${ent.name} (${ent.type})`,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
        })
      );

      const attrRows = [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph('Attribute')] }),
            new TableCell({ children: [new Paragraph('Key Type')] }),
            new TableCell({ children: [new Paragraph('Data Type')] }),
            new TableCell({ children: [new Paragraph('Nullable')] }),
            new TableCell({ children: [new Paragraph('Description')] }),
          ],
        }),
      ];

      for (const a of ent.attributes) {
        attrRows.push(
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph(a.name)] }),
              new TableCell({ children: [new Paragraph(a.keyType)] }),
              new TableCell({ children: [new Paragraph(a.dataType)] }),
              new TableCell({ children: [new Paragraph(a.isNullable ? 'Yes' : 'No')] }),
              new TableCell({ children: [new Paragraph(a.description || '—')] }),
            ],
          })
        );
      }

      docChildren.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: attrRows,
        }),
        new Paragraph({ text: '', spacing: { after: 200 } })
      );
    }
  }

  // Section 4: Relationships
  if (sections.s4) {
    docChildren.push(
      new Paragraph({
        text: '4.0 Relationships & Logic (Image 4 Format)',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );

    const relRows = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Statement')] }),
          new TableCell({ children: [new Paragraph('Cardinality')] }),
          new TableCell({ children: [new Paragraph('Bidirectional Descriptions')] }),
          new TableCell({ children: [new Paragraph('Cascade Rule')] }),
        ],
      }),
    ];

    for (const r of relationships) {
      relRows.push(
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(`[${r.source_entity_name}] is related to [${r.target_entity_name}]`)] }),
            new TableCell({ children: [new Paragraph(r.cardinality)] }),
            new TableCell({ children: [new Paragraph(`(a) ${r.bidirectional?.forward}\n(b) ${r.bidirectional?.reverse}`)] }),
            new TableCell({ children: [new Paragraph(`ON DELETE ${r.on_delete || 'CASCADE'}`)] }),
          ],
        })
      );
    }

    docChildren.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: relRows,
      }),
      new Paragraph({ text: '', spacing: { after: 300 } })
    );
  }

  // Section 7: De-normalization
  if (sections.s7) {
    docChildren.push(
      new Paragraph({
        text: '7.0 De-normalization Summary',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );

    const denormRows = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('De-normalized Table')] }),
          new TableCell({ children: [new Paragraph('Absorbed Parents')] }),
          new TableCell({ children: [new Paragraph('Inherited Columns')] }),
        ],
      }),
    ];

    for (const t of denormData.denormalizedTables.filter((x) => x.isDenormalized)) {
      const inherited = t.attributes.filter((a) => a.origin === 'inherited').map((a) => a.name).join(', ');
      denormRows.push(
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(t.name)] }),
            new TableCell({ children: [new Paragraph(t.absorbedParents.join(', '))] }),
            new TableCell({ children: [new Paragraph(inherited || 'None')] }),
          ],
        })
      );
    }

    docChildren.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: denormRows,
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: docChildren,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

/**
 * 4. MARKDOWN EXPORT
 */
export async function generateMarkdownDocument(projectId, options = {}) {
  const { title = 'Database Design Specification', author = 'Architect Team' } = options;
  const projRes = await query('SELECT * FROM projects WHERE id = $1', [projectId]);
  const project = projRes.rows[0] || { name: 'Software Project' };

  const entities = await getProjectEntities(projectId);
  const relationships = await getProjectRelationships(projectId);
  const denormData = await computeDenormalizedSchema(projectId);

  const lines = [
    `# ${title}`,
    `**Project:** ${project.name}  `,
    `**Author:** ${author}  `,
    `**Date:** ${new Date().toLocaleDateString()}  `,
    `\n---\n`,
    `## 1.0 Introduction & Relational Methodology`,
    `This architectural document outlines the relational database model for **${project.name}**.\n`,
    `## 2.0 Entity Sets & Classification`,
    `| Entity Name | Type | Identifying Parent | Description |`,
    `| :--- | :--- | :--- | :--- |`,
    ...entities.map((e) => {
      const p = entities.find((x) => x.id === e.parent_entity_id);
      return `| **${e.name}** | ${e.type} | ${p ? p.name : '—'} | ${e.description || 'Standard Entity'} |`;
    }),
    `\n## 3.0 Attribute Tables`,
  ];

  for (const ent of entities) {
    lines.push(`### Entity: ${ent.name} (${ent.type})`);
    lines.push(`| Attribute | Key Type | Data Type | Nullable | Description |`);
    lines.push(`| :--- | :--- | :--- | :--- | :--- |`);
    for (const a of ent.attributes) {
      lines.push(`| \`${a.name}\` | ${a.keyType} | \`${a.dataType}\` | ${a.isNullable ? 'Yes' : 'No'} | ${a.description || '—'} |`);
    }
    lines.push('');
  }

  lines.push(`## 4.0 Relationships & Cardinality`);
  lines.push(`| Statement | Cardinality | Bidirectional Semantics | Cascade Rule |`);
  lines.push(`| :--- | :--- | :--- | :--- |`);
  for (const r of relationships) {
    lines.push(`| [${r.source_entity_name}] is related to [${r.target_entity_name}] | **${r.cardinality}** | (a) ${r.bidirectional?.forward}<br>(b) ${r.bidirectional?.reverse} | \`ON DELETE ${r.on_delete}\` |`);
  }

  lines.push(`\n## 5.0 Visual Mermaid ERD Diagram`);
  lines.push('```mermaid');
  lines.push('erDiagram');
  for (const ent of entities) {
    lines.push(`  ${ent.name.toUpperCase()} {`);
    for (const a of ent.attributes) {
      lines.push(`    ${a.dataType} ${a.name}`);
    }
    lines.push(`  }`);
  }
  for (const r of relationships) {
    let relSymbol = '||--o{';
    if (r.cardinality === '1:1') relSymbol = '||--||';
    else if (r.cardinality === 'M:N') relSymbol = '}o--o{';
    lines.push(`  ${r.source_entity_name.toUpperCase()} ${relSymbol} ${r.target_entity_name.toUpperCase()} : "${r.name || 'relates'}"`);
  }
  lines.push('```\n');

  lines.push(`## 7.0 De-normalization Analysis`);
  lines.push(`| De-normalized Table | Absorbed Parents | Inherited Descriptive Columns |`);
  lines.push(`| :--- | :--- | :--- |`);
  for (const t of denormData.denormalizedTables.filter((x) => x.isDenormalized)) {
    const inherited = t.attributes.filter((a) => a.origin === 'inherited').map((a) => a.name).join(', ');
    lines.push(`| **${t.name}** | ${t.absorbedParents.join(', ')} | \`${inherited || 'None'}\` |`);
  }

  return lines.join('\n');
}

