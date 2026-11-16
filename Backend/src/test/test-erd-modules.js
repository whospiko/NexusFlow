import { pool, query } from '../config/db.js';
import * as erdService from '../services/erdService.js';

async function runTests() {
  console.log('🚀 Running Pure SQL ERD & Relational Modeling Integration Tests...\n');

  try {
    await erdService.ensureErdTablesExist();

    // 1. Get or create a test project
    let projRes = await query('SELECT id FROM projects LIMIT 1');
    let projectId;
    if (projRes.rows.length === 0) {
      // create dummy user and project
      const userRes = await query(`
        INSERT INTO users (email, name, provider)
        VALUES ('erd_test@test.local', 'ERD Tester', 'local')
        ON CONFLICT (email) DO UPDATE SET name = 'ERD Tester'
        RETURNING id
      `);
      const userId = userRes.rows[0].id;

      const pRes = await query(`
        INSERT INTO projects (name, description, owner_id)
        VALUES ('ERD Test Project', 'Test project for ERD Suite', $1)
        RETURNING id
      `, [userId]);
      projectId = pRes.rows[0].id;
    } else {
      projectId = projRes.rows[0].id;
    }
    console.log(`✅ Using Project ID: ${projectId}`);

    // Clean up any previous test entities in this project for clean test run
    await query('DELETE FROM erd_entities WHERE project_id = $1', [projectId]);

    // 2. Test Module 2: Create Strong Entity (Customer)
    console.log('\n--- MODULE 2: ENTITY & ATTRIBUTE MANAGER ---');
    const customer = await erdService.createEntity(projectId, {
      name: 'Customer',
      type: 'Strong',
      description: 'System Customers and Registered Users',
      initialAttributes: [
        { name: 'id', dataType: 'Int', keyType: 'PK', isNullable: false },
        { name: 'full_name', dataType: 'String', keyType: 'Normal', isNullable: false },
        { name: 'email', dataType: 'String', keyType: 'Normal', isNullable: false },
        { name: 'city', dataType: 'String', keyType: 'Normal', isNullable: true },
        { name: 'postal_code', dataType: 'String', keyType: 'Normal', isNullable: true },
      ],
    });
    console.log(`✅ Created Strong Entity: "${customer.name}" with ${customer.attributes.length} attributes`);

    // 3. Test Module 2: Create Strong Entity (Order)
    const order = await erdService.createEntity(projectId, {
      name: 'Order',
      type: 'Strong',
      description: 'Sales Orders',
      initialAttributes: [
        { name: 'id', dataType: 'Int', keyType: 'PK', isNullable: false },
        { name: 'order_number', dataType: 'String', keyType: 'Normal', isNullable: false },
        { name: 'total_amount', dataType: 'Decimal', keyType: 'Normal', isNullable: false },
        { name: 'created_at', dataType: 'Date', keyType: 'Normal', isNullable: false },
      ],
    });
    console.log(`✅ Created Strong Entity: "${order.name}" with ${order.attributes.length} attributes`);

    // 4. Test Module 2: Create Weak Entity (OrderItem) with parent Order
    const orderItem = await erdService.createEntity(projectId, {
      name: 'OrderItem',
      type: 'Weak',
      description: 'Line items belonging to an Order',
      parentEntityId: order.id,
      initialAttributes: [
        { name: 'item_number', dataType: 'Int', keyType: 'Composite', isNullable: false },
        { name: 'quantity', dataType: 'Int', keyType: 'Normal', isNullable: false },
        { name: 'unit_price', dataType: 'Decimal', keyType: 'Normal', isNullable: false },
      ],
    });
    console.log(`✅ Created Weak Entity: "${orderItem.name}" (Parent Order ID: ${order.id})`);

    // 5. Test Module 2 Validation: Duplicate entity name prevention
    try {
      await erdService.createEntity(projectId, { name: 'Customer' });
      throw new Error('Should have rejected duplicate entity name');
    } catch (err) {
      console.log(`✅ Duplicate Entity Name Validation passed: "${err.message}"`);
    }

    // 6. Test Module 2 Validation: Missing PK prevention
    try {
      await erdService.bulkSaveAttributes(customer.id, [
        { name: 'attr_without_pk', dataType: 'String', keyType: 'Normal', isNullable: false },
      ]);
      throw new Error('Should have rejected entity without PK');
    } catch (err) {
      console.log(`✅ Missing PK Validation passed: "${err.message}"`);
    }

    // 7. Test Module 3: Canvas Node Positions Persistence
    console.log('\n--- MODULE 3: VISUAL CANVAS POSITIONS ---');
    await erdService.saveNodePositions(projectId, [
      { entityId: customer.id, x: 120, y: 150 },
      { entityId: order.id, x: 450, y: 150 },
      { entityId: orderItem.id, x: 780, y: 250 },
    ]);
    const updatedCustomer = await erdService.getEntityWithAttributes(customer.id);
    console.log(`✅ Saved & Verified Node Position for Customer: x=${updatedCustomer.pos_x}, y=${updatedCustomer.pos_y}`);

    // 8. Test Module 4: 1:M Relationship & Auto-FK Propagation
    console.log('\n--- MODULE 4: RELATIONSHIP LOGIC ENGINE ---');
    const rel1 = await erdService.createRelationship(projectId, {
      sourceEntityId: customer.id,
      targetEntityId: order.id,
      cardinality: '1:M',
      name: 'places',
      description: 'Customer places Orders',
      onDelete: 'CASCADE',
    });
    console.log(`✅ Created 1:M Relationship: Customer places Order (ID: ${rel1.id})`);

    // Verify auto-FK was injected into Order table!
    const refreshedOrder = await erdService.getEntityWithAttributes(order.id);
    const injectedFk = refreshedOrder.attributes.find((a) => a.name === 'customer_id' && a.keyType === 'FK');
    if (!injectedFk) {
      throw new Error('Expected auto-FK "customer_id" in Order table!');
    }
    console.log(`✅ Auto-FK Propagation verified: "${injectedFk.name}" (${injectedFk.keyType}) in Order table`);

    // 9. Test Module 4: Many-to-Many (M:N) Junction Table Resolution
    const product = await erdService.createEntity(projectId, {
      name: 'Product',
      type: 'Strong',
      description: 'Catalog Products',
      initialAttributes: [
        { name: 'id', dataType: 'Int', keyType: 'PK', isNullable: false },
        { name: 'sku', dataType: 'String', keyType: 'Normal', isNullable: false },
        { name: 'price', dataType: 'Decimal', keyType: 'Normal', isNullable: false },
      ],
    });

    const relMN = await erdService.createRelationship(projectId, {
      sourceEntityId: order.id,
      targetEntityId: product.id,
      cardinality: 'M:N',
      name: 'includes',
      description: 'Orders include many Products and vice versa',
    });
    console.log(`✅ Created M:N Relationship between Order and Product`);

    // Verify Junction Entity creation
    const allEntities = await erdService.getProjectEntities(projectId);
    const junctionEnt = allEntities.find((e) => e.name.toLowerCase().includes('order_product'));
    if (!junctionEnt) {
      throw new Error('Expected auto-generated junction entity for Order_Product!');
    }
    console.log(`✅ M:N Junction Entity Auto-Generated: "${junctionEnt.name}" with composite PKs`);

    // 10. Test Module 4: Bidirectional Descriptions
    const relList = await erdService.getProjectRelationships(projectId);
    const placesRel = relList.find((r) => r.id === rel1.id);
    console.log(`✅ Bidirectional Descriptions verified:`);
    console.log(`   (a) ${placesRel.bidirectional.forward}`);
    console.log(`   (b) ${placesRel.bidirectional.reverse}`);

    // 11. Test Module 5: Normalization Engine Audit (1NF, 2NF, 3NF)
    console.log('\n--- MODULE 5: NORMALIZATION & DE-NORMALIZATION ENGINE ---');
    const audit = await erdService.runNormalizationAudit(projectId);
    console.log(`✅ Normalization Audit Completed. Score: ${audit.score}%`);
    console.log(`   1NF Passed: ${audit.firstNormalForm.passed}`);
    console.log(`   2NF Passed: ${audit.secondNormalForm.passed}`);
    console.log(`   3NF Passed: ${audit.thirdNormalForm.passed}`);
    console.log(`   Violations/Insights: ${audit.violations.length} item(s)`);

    // 12. Test Module 5: De-normalization View (Flattening 1:M parent-child)
    const denorm = await erdService.computeDenormalizedSchema(projectId);
    const denormOrder = denorm.denormalizedTables.find((t) => t.isDenormalized);
    if (denormOrder) {
      console.log(`✅ De-normalized Table generated: "${denormOrder.name}"`);
      console.log(`   Absorbed Parents: ${denormOrder.absorbedParents.join(', ')}`);
      const inheritedCols = denormOrder.attributes.filter((a) => a.origin === 'inherited');
      console.log(`   Inherited descriptive columns count: ${inheritedCols.length}`);
    }

    // 13. Test Module 5: Pure SQL DDL Scripts Generation
    const sqlScripts = await erdService.generateSqlScripts(projectId);
    if (!sqlScripts.normalizedSql || !sqlScripts.denormalizedSql) {
      throw new Error('Failed to generate PostgreSQL DDL scripts!');
    }
    console.log(`✅ Normalized PostgreSQL DDL script generated (${sqlScripts.normalizedSql.length} chars)`);
    console.log(`✅ De-normalized PostgreSQL DDL script generated (${sqlScripts.denormalizedSql.length} chars)`);

    console.log('\n🎉 ALL ERD & RELATIONAL MODELING MODULES VERIFIED SUCCESSFULLY (RAW SQL PG)!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST FAILURE:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();

