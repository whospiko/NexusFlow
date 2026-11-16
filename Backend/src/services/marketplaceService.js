import { query } from '../config/db.js';
import * as schemaVersionService from './schemaVersionService.js';
import * as erdService from './erdService.js';

// Top-tier Seed Community Models & Schemas
const SEED_TEMPLATES = [
  {
    id: 'tpl-ecommerce-marketplace',
    title: 'E-Commerce & Multi-Vendor Marketplace',
    description: 'Production-ready online store with product variants, shopping carts, order fulfillment, Stripe/Bakong payments, and customer reviews.',
    category: 'E-Commerce',
    author: 'Antigravity Core',
    rating: 4.9,
    downloads_count: 2480,
    is_official: true,
    tags: ['E-Commerce', 'Orders', 'Payments', '3NF', 'High Concurrency'],
    schema_data: {
      entities: [
        {
          name: 'users',
          type: 'Strong',
          description: 'Registered shoppers and merchants',
          attributes: [
            { name: 'id', dataType: 'BigInt', keyType: 'PK', isNullable: false },
            { name: 'email', dataType: 'String', keyType: 'Normal', isNullable: false },
            { name: 'password_hash', dataType: 'String', keyType: 'Normal', isNullable: false },
            { name: 'name', dataType: 'String', keyType: 'Normal', isNullable: false },
            { name: 'phone', dataType: 'String', keyType: 'Normal', isNullable: true },
            { name: 'role', dataType: 'String', keyType: 'Normal', isNullable: false, defaultValue: 'customer' },
            { name: 'created_at', dataType: 'Timestamp', keyType: 'Normal', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
          ],
        },
        {
          name: 'categories',
          type: 'Strong',
          description: 'Product taxonomy hierarchy',
          attributes: [
            { name: 'id', dataType: 'Integer', keyType: 'PK', isNullable: false },
            { name: 'name', dataType: 'String', keyType: 'Normal', isNullable: false },
            { name: 'slug', dataType: 'String', keyType: 'Normal', isNullable: false },
            { name: 'parent_id', dataType: 'Integer', keyType: 'FK', isNullable: true },
          ],
        },
        {
          name: 'products',
          type: 'Strong',
          description: 'Catalog items with pricing and inventory',
          attributes: [
            { name: 'id', dataType: 'BigInt', keyType: 'PK', isNullable: false },
            { name: 'category_id', dataType: 'Integer', keyType: 'FK', isNullable: false },
            { name: 'title', dataType: 'String', keyType: 'Normal', isNullable: false },
            { name: 'sku', dataType: 'String', keyType: 'Normal', isNullable: false },
            { name: 'price', dataType: 'Decimal', keyType: 'Normal', isNullable: false },
            { name: 'stock_quantity', dataType: 'Integer', keyType: 'Normal', isNullable: false, defaultValue: '0' },
            { name: 'is_active', dataType: 'Boolean', keyType: 'Normal', isNullable: false, defaultValue: 'true' },
          ],
        },
        {
          name: 'orders',
          type: 'Strong',
          description: 'Customer purchase checkout sessions',
          attributes: [
            { name: 'id', dataType: 'BigInt', keyType: 'PK', isNullable: false },
            { name: 'user_id', dataType: 'BigInt', keyType: 'FK', isNullable: false },
            { name: 'order_number', dataType: 'String', keyType: 'Normal', isNullable: false },
            { name: 'total_amount', dataType: 'Decimal', keyType: 'Normal', isNullable: false },
            { name: 'status', dataType: 'String', keyType: 'Normal', isNullable: false, defaultValue: 'pending' },
            { name: 'created_at', dataType: 'Timestamp', keyType: 'Normal', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
          ],
        },
        {
          name: 'order_items',
          type: 'Weak',
          description: 'Line item records inside an order',
          attributes: [
            { name: 'id', dataType: 'BigInt', keyType: 'PK', isNullable: false },
            { name: 'order_id', dataType: 'BigInt', keyType: 'FK', isNullable: false },
            { name: 'product_id', dataType: 'BigInt', keyType: 'FK', isNullable: false },
            { name: 'unit_price', dataType: 'Decimal', keyType: 'Normal', isNullable: false },
            { name: 'quantity', dataType: 'Integer', keyType: 'Normal', isNullable: false, defaultValue: '1' },
          ],
        },
        {
          name: 'payments',
          type: 'Strong',
          description: 'Payment settlements and gateway webhooks',
          attributes: [
            { name: 'id', dataType: 'BigInt', keyType: 'PK', isNullable: false },
            { name: 'order_id', dataType: 'BigInt', keyType: 'FK', isNullable: false },
            { name: 'payment_method', dataType: 'String', keyType: 'Normal', isNullable: false },
            { name: 'amount', dataType: 'Decimal', keyType: 'Normal', isNullable: false },
            { name: 'transaction_ref', dataType: 'String', keyType: 'Normal', isNullable: false },
            { name: 'status', dataType: 'String', keyType: 'Normal', isNullable: false, defaultValue: 'completed' },
          ],
        },
      ],
      relationships: [
        { sourceEntityName: 'users', targetEntityName: 'orders', cardinality: '1:M', name: 'places' },
        { sourceEntityName: 'categories', targetEntityName: 'products', cardinality: '1:M', name: 'categorizes' },
        { sourceEntityName: 'orders', targetEntityName: 'order_items', cardinality: '1:M', name: 'contains', isIdentifying: true },
        { sourceEntityName: 'products', targetEntityName: 'order_items', cardinality: '1:M', name: 'includes' },
        { sourceEntityName: 'orders', targetEntityName: 'payments', cardinality: '1:1', name: 'settled by' },
      ],
      positions: [
        { entityName: 'users', x: 80, y: 80 },
        { entityName: 'orders', x: 400, y: 80 },
        { entityName: 'payments', x: 740, y: 80 },
        { entityName: 'categories', x: 80, y: 350 },
        { entityName: 'products', x: 400, y: 350 },
        { entityName: 'order_items', x: 740, y: 350 },
      ],
    },
  },
  {
    id: 'tpl-healthcare-telehealth',
    title: 'Hospital & Clinic Telehealth Management',
    description: 'HIPAA-compliant healthcare model for patient demographics, medical staff, appointment scheduling, electronic medical records (EMR), and e-prescriptions.',
    category: 'Healthcare',
    author: 'MedTech Systems',
    rating: 4.95,
    downloads_count: 1840,
    is_official: true,
    tags: ['Healthcare', 'HIPAA', 'EMR', 'Telehealth', 'Appointments'],
    schema_data: {
      entities: [
        {
          name: 'patients',
          type: 'Strong',
          description: 'Patient identity and health record index',
          attributes: [
            { name: 'id', dataType: 'BigInt', keyType: 'PK', isNullable: false },
            { name: 'medical_record_no', dataType: 'String', keyType: 'Normal', isNullable: false },
            { name: 'full_name', dataType: 'String', keyType: 'Normal', isNullable: false },
            { name: 'dob', dataType: 'Date', keyType: 'Normal', isNullable: false },
            { name: 'blood_type', dataType: 'String', keyType: 'Normal', isNullable: true },
            { name: 'phone', dataType: 'String', keyType: 'Normal', isNullable: false },
          ],
        },
        {
          name: 'doctors',
          type: 'Strong',
          description: 'Physicians and clinical specialists',
          attributes: [
            { name: 'id', dataType: 'BigInt', keyType: 'PK', isNullable: false },
            { name: 'name', dataType: 'String', keyType: 'Normal', isNullable: false },
            { name: 'specialization', dataType: 'String', keyType: 'Normal', isNullable: false },
            { name: 'license_number', dataType: 'String', keyType: 'Normal', isNullable: false },
          ],
        },
        {
          name: 'appointments',
          type: 'Strong',
          description: 'Clinical visits and telehealth sessions',
          attributes: [
            { name: 'id', dataType: 'BigInt', keyType: 'PK', isNullable: false },
            { name: 'patient_id', dataType: 'BigInt', keyType: 'FK', isNullable: false },
            { name: 'doctor_id', dataType: 'BigInt', keyType: 'FK', isNullable: false },
            { name: 'appointment_time', dataType: 'Timestamp', keyType: 'Normal', isNullable: false },
            { name: 'status', dataType: 'String', keyType: 'Normal', isNullable: false, defaultValue: 'scheduled' },
          ],
        },
        {
          name: 'prescriptions',
          type: 'Strong',
          description: 'Medication directives issued by physician',
          attributes: [
            { name: 'id', dataType: 'BigInt', keyType: 'PK', isNullable: false },
            { name: 'appointment_id', dataType: 'BigInt', keyType: 'FK', isNullable: false },
            { name: 'medication_name', dataType: 'String', keyType: 'Normal', isNullable: false },
            { name: 'dosage', dataType: 'String', keyType: 'Normal', isNullable: false },
            { name: 'instructions', dataType: 'Text', keyType: 'Normal', isNullable: true },
          ],
        },
      ],
      relationships: [
        { sourceEntityName: 'patients', targetEntityName: 'appointments', cardinality: '1:M', name: 'attends' },
        { sourceEntityName: 'doctors', targetEntityName: 'appointments', cardinality: '1:M', name: 'examines' },
        { sourceEntityName: 'appointments', targetEntityName: 'prescriptions', cardinality: '1:M', name: 'prescribes' },
      ],
      positions: [
        { entityName: 'patients', x: 80, y: 100 },
        { entityName: 'doctors', x: 80, y: 350 },
        { entityName: 'appointments', x: 420, y: 220 },
        { entityName: 'prescriptions', x: 760, y: 220 },
      ],
    },
  },
  {
    id: 'tpl-fintech-banking',
    title: 'Digital Banking & FinTech Wallet Architecture',
    description: 'Double-entry ledger accounting, multi-currency wallets, beneficiary address book, virtual debit cards, and audit-logged financial transfers.',
    category: 'FinTech',
    author: 'PayFlow Architect',
    rating: 4.88,
    downloads_count: 3120,
    is_official: true,
    tags: ['FinTech', 'Double Entry', 'Wallets', 'PCI-DSS', 'Banking'],
    schema_data: {
      entities: [
        {
          name: 'customers',
          type: 'Strong',
          description: 'KYC verified banking customer accounts',
          attributes: [
            { name: 'id', dataType: 'BigInt', keyType: 'PK', isNullable: false },
            { name: 'cif_number', dataType: 'String', keyType: 'Normal', isNullable: false },
            { name: 'legal_name', dataType: 'String', keyType: 'Normal', isNullable: false },
            { name: 'kyc_status', dataType: 'String', keyType: 'Normal', isNullable: false, defaultValue: 'verified' },
          ],
        },
        {
          name: 'accounts',
          type: 'Strong',
          description: 'Depository ledger accounts (Savings / Checking / Wallets)',
          attributes: [
            { name: 'id', dataType: 'BigInt', keyType: 'PK', isNullable: false },
            { name: 'customer_id', dataType: 'BigInt', keyType: 'FK', isNullable: false },
            { name: 'account_number', dataType: 'String', keyType: 'Normal', isNullable: false },
            { name: 'currency', dataType: 'String', keyType: 'Normal', isNullable: false, defaultValue: 'USD' },
            { name: 'current_balance', dataType: 'Decimal', keyType: 'Normal', isNullable: false, defaultValue: '0.00' },
          ],
        },
        {
          name: 'transactions',
          type: 'Strong',
          description: 'Immutable ledger journal debit/credit records',
          attributes: [
            { name: 'id', dataType: 'BigInt', keyType: 'PK', isNullable: false },
            { name: 'source_account_id', dataType: 'BigInt', keyType: 'FK', isNullable: false },
            { name: 'target_account_id', dataType: 'BigInt', keyType: 'FK', isNullable: false },
            { name: 'amount', dataType: 'Decimal', keyType: 'Normal', isNullable: false },
            { name: 'fee', dataType: 'Decimal', keyType: 'Normal', isNullable: false, defaultValue: '0.00' },
            { name: 'reference_code', dataType: 'String', keyType: 'Normal', isNullable: false },
            { name: 'created_at', dataType: 'Timestamp', keyType: 'Normal', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
          ],
        },
      ],
      relationships: [
        { sourceEntityName: 'customers', targetEntityName: 'accounts', cardinality: '1:M', name: 'owns' },
        { sourceEntityName: 'accounts', targetEntityName: 'transactions', cardinality: '1:M', name: 'initiates' },
      ],
      positions: [
        { entityName: 'customers', x: 80, y: 150 },
        { entityName: 'accounts', x: 420, y: 150 },
        { entityName: 'transactions', x: 760, y: 150 },
      ],
    },
  },
  {
    id: 'tpl-saas-multitenant',
    title: 'SaaS Multi-Tenant Subscription Engine',
    description: 'B2B subscription billing model with organization workspaces, subscription tiers, member roles, feature flags, and Stripe recurring invoices.',
    category: 'SaaS',
    author: 'CloudOps Foundation',
    rating: 4.92,
    downloads_count: 2190,
    is_official: true,
    tags: ['SaaS', 'Multi-Tenancy', 'Stripe', 'Billing', 'RBAC'],
    schema_data: {
      entities: [
        {
          name: 'tenants',
          type: 'Strong',
          description: 'Organization workspace account boundary',
          attributes: [
            { name: 'id', dataType: 'BigInt', keyType: 'PK', isNullable: false },
            { name: 'name', dataType: 'String', keyType: 'Normal', isNullable: false },
            { name: 'domain_slug', dataType: 'String', keyType: 'Normal', isNullable: false },
            { name: 'plan_tier', dataType: 'String', keyType: 'Normal', isNullable: false, defaultValue: 'pro' },
          ],
        },
        {
          name: 'memberships',
          type: 'Weak',
          description: 'User access role inside a tenant organization',
          attributes: [
            { name: 'id', dataType: 'BigInt', keyType: 'PK', isNullable: false },
            { name: 'tenant_id', dataType: 'BigInt', keyType: 'FK', isNullable: false },
            { name: 'user_id', dataType: 'BigInt', keyType: 'Normal', isNullable: false },
            { name: 'role', dataType: 'String', keyType: 'Normal', isNullable: false, defaultValue: 'member' },
          ],
        },
        {
          name: 'invoices',
          type: 'Strong',
          description: 'Monthly and annual SaaS billing statements',
          attributes: [
            { name: 'id', dataType: 'BigInt', keyType: 'PK', isNullable: false },
            { name: 'tenant_id', dataType: 'BigInt', keyType: 'FK', isNullable: false },
            { name: 'amount_due', dataType: 'Decimal', keyType: 'Normal', isNullable: false },
            { name: 'status', dataType: 'String', keyType: 'Normal', isNullable: false, defaultValue: 'paid' },
            { name: 'invoice_pdf_url', dataType: 'String', keyType: 'Normal', isNullable: true },
          ],
        },
      ],
      relationships: [
        { sourceEntityName: 'tenants', targetEntityName: 'memberships', cardinality: '1:M', name: 'employs', isIdentifying: true },
        { sourceEntityName: 'tenants', targetEntityName: 'invoices', cardinality: '1:M', name: 'bills' },
      ],
      positions: [
        { entityName: 'tenants', x: 120, y: 150 },
        { entityName: 'memberships', x: 460, y: 150 },
        { entityName: 'invoices', x: 800, y: 150 },
      ],
    },
  },
  {
    id: 'tpl-university-lms',
    title: 'University LMS & School Academic System',
    description: 'Higher-education student enrollment portal with course syllabus, professor allocations, assignment submissions, and grading GPA calculations.',
    category: 'Education',
    author: 'RUPP Academic Hub',
    rating: 4.85,
    downloads_count: 1450,
    is_official: true,
    tags: ['Education', 'LMS', 'Students', 'Courses', 'Academic'],
    schema_data: {
      entities: [
        {
          name: 'students',
          type: 'Strong',
          description: 'Enrolled academic students',
          attributes: [
            { name: 'id', dataType: 'BigInt', keyType: 'PK', isNullable: false },
            { name: 'student_id_code', dataType: 'String', keyType: 'Normal', isNullable: false },
            { name: 'full_name', dataType: 'String', keyType: 'Normal', isNullable: false },
            { name: 'major', dataType: 'String', keyType: 'Normal', isNullable: false },
          ],
        },
        {
          name: 'courses',
          type: 'Strong',
          description: 'Curriculum syllabus and credit units',
          attributes: [
            { name: 'id', dataType: 'BigInt', keyType: 'PK', isNullable: false },
            { name: 'course_code', dataType: 'String', keyType: 'Normal', isNullable: false },
            { name: 'title', dataType: 'String', keyType: 'Normal', isNullable: false },
            { name: 'credits', dataType: 'Integer', keyType: 'Normal', isNullable: false, defaultValue: '3' },
          ],
        },
        {
          name: 'enrollments',
          type: 'Weak',
          description: 'Student course registration and semester grade',
          attributes: [
            { name: 'id', dataType: 'BigInt', keyType: 'PK', isNullable: false },
            { name: 'student_id', dataType: 'BigInt', keyType: 'FK', isNullable: false },
            { name: 'course_id', dataType: 'BigInt', keyType: 'FK', isNullable: false },
            { name: 'semester', dataType: 'String', keyType: 'Normal', isNullable: false },
            { name: 'grade_point', dataType: 'Decimal', keyType: 'Normal', isNullable: true },
          ],
        },
      ],
      relationships: [
        { sourceEntityName: 'students', targetEntityName: 'enrollments', cardinality: '1:M', name: 'registers' },
        { sourceEntityName: 'courses', targetEntityName: 'enrollments', cardinality: '1:M', name: 'hosts' },
      ],
      positions: [
        { entityName: 'students', x: 80, y: 120 },
        { entityName: 'courses', x: 80, y: 350 },
        { entityName: 'enrollments', x: 440, y: 230 },
      ],
    },
  },
];

/**
 * Ensure marketplace tables exist and seed default templates
 */
export async function ensureMarketplaceTablesExist() {
  try {
    await query(`
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;

      CREATE TABLE IF NOT EXISTS marketplace_templates (
        id VARCHAR(100) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(50) NOT NULL DEFAULT 'General',
        author VARCHAR(100) NOT NULL DEFAULT 'Community',
        rating DOUBLE PRECISION DEFAULT 4.9,
        downloads_count INTEGER DEFAULT 0,
        is_official BOOLEAN DEFAULT false,
        tags TEXT[],
        schema_data JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_mkt_category ON marketplace_templates(category);
    `);

    // Seed default starter templates if not already present
    for (const tpl of SEED_TEMPLATES) {
      await query(
        `INSERT INTO marketplace_templates (
          id, title, description, category, author, rating, downloads_count, is_official, tags, schema_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          tags = EXCLUDED.tags,
          schema_data = EXCLUDED.schema_data;`,
        [
          tpl.id,
          tpl.title,
          tpl.description,
          tpl.category,
          tpl.author,
          tpl.rating,
          tpl.downloads_count,
          tpl.is_official,
          tpl.tags,
          JSON.stringify(tpl.schema_data),
        ]
      );
    }

    console.log('✅ Template Marketplace tables and community models verified & seeded');
  } catch (err) {
    console.error('⚠️ Could not verify marketplace tables:', err.message);
  }
}

/**
 * Browse Marketplace Templates with category and search filter
 */
export async function getMarketplaceTemplates(options = {}) {
  const { category, search } = options;
  let sql = 'SELECT * FROM marketplace_templates WHERE 1=1';
  const params = [];

  if (category && category !== 'All') {
    params.push(category);
    sql += ` AND category = $${params.length}`;
  }

  if (search && search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`);
    sql += ` AND (LOWER(title) LIKE $${params.length} OR LOWER(description) LIKE $${params.length} OR $${params.length} = ANY(tags))`;
  }

  sql += ' ORDER BY is_official DESC, downloads_count DESC;';
  const result = await query(sql, params);
  return result.rows;
}

/**
 * Get Template by ID
 */
export async function getMarketplaceTemplateById(templateId) {
  const result = await query('SELECT * FROM marketplace_templates WHERE id = $1', [templateId]);
  if (result.rows.length === 0) {
    throw new Error(`Template '${templateId}' not found in Marketplace catalog.`);
  }
  return result.rows[0];
}

/**
 * Publish a user's project schema as a public template in the Marketplace
 */
export async function publishProjectAsTemplate(projectId, {
  title,
  description,
  category = 'General',
  tags = [],
  author = 'Piko',
}) {
  const schemaSnapshot = await schemaVersionService.captureSchemaSnapshot(projectId);
  const templateId = `tpl-user-${projectId}-${Date.now().toString(36)}`;

  const cleanTags = Array.isArray(tags) ? tags : ['Community Model', category];

  const insertSql = `
    INSERT INTO marketplace_templates (
      id, title, description, category, author, rating, downloads_count, is_official, tags, schema_data
    ) VALUES ($1, $2, $3, $4, $5, 5.0, 1, false, $6, $7)
    RETURNING *;
  `;

  const result = await query(insertSql, [
    templateId,
    title || `Custom Schema Model (Project #${projectId})`,
    description || 'Community published relational database schema model.',
    category,
    author,
    cleanTags,
    JSON.stringify(schemaSnapshot),
  ]);

  return result.rows[0];
}

/**
 * Clone a template into an existing active project
 */
export async function cloneTemplateToProject(projectId, templateId, actor = 'Piko') {
  const template = await getMarketplaceTemplateById(templateId);

  // Increment download / clone count
  await query('UPDATE marketplace_templates SET downloads_count = downloads_count + 1 WHERE id = $1', [templateId]);

  // Restore schema data into target project
  const restoreResult = await schemaVersionService.restoreSchemaToProject(projectId, template.schema_data, actor);

  return {
    success: true,
    message: `Template '${template.title}' successfully cloned into project!`,
    template,
    restoreResult,
  };
}

/**
 * Clone template as a brand new project
 */
export async function cloneTemplateAsNewProject(userId, templateId, newProjectName = null) {
  const template = await getMarketplaceTemplateById(templateId);
  const finalName = newProjectName || `${template.title} (Clone)`;

  // Create new project
  const projRes = await query(
    'INSERT INTO projects (name, description, owner_id) VALUES ($1, $2, $3) RETURNING *',
    [finalName, template.description, userId || 1]
  );
  const newProject = projRes.rows[0];

  // Add owner to members
  await query(
    'INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
    [newProject.id, userId || 1, 'owner']
  );

  // Increment download count
  await query('UPDATE marketplace_templates SET downloads_count = downloads_count + 1 WHERE id = $1', [templateId]);

  // Populate schema into new project
  await schemaVersionService.restoreSchemaToProject(newProject.id, template.schema_data, 'Marketplace Clone');

  return newProject;
}

/**
 * Rate a marketplace template (1 - 5 stars)
 */
export async function rateTemplate(templateId, newRating = 5) {
  const validRating = Math.max(1, Math.min(5, Number(newRating)));
  const result = await query(
    `UPDATE marketplace_templates
     SET rating = ROUND(((rating * downloads_count + $1) / (downloads_count + 1))::numeric, 2),
         downloads_count = downloads_count + 1
     WHERE id = $2
     RETURNING id, rating, downloads_count;`,
    [validRating, templateId]
  );
  return result.rows[0];
}

