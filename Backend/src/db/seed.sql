-- ==========================================================
-- Bug Tracker & ITPM Enterprise Seed Data
-- 3 Simulated Real-World Software Engineering Projects:
-- 1. Sombok Express E-Commerce Platform
-- 2. PayFlow Digital Banking Gateway
-- 3. CareFlow Telehealth & Clinic Management
-- ==========================================================

-- 1. Seed Users
INSERT INTO users (id, email, name, avatar_url, provider) VALUES
(1, 'piko@company.com', 'Piko', 'https://api.dicebear.com/7.x/bottts/svg?seed=Piko', 'local'),
(2, 'pisey@company.com', 'Pisey', 'https://api.dicebear.com/7.x/bottts/svg?seed=Pisey', 'local'),
(3, 'alex.v@company.com', 'Alex V.', 'https://api.dicebear.com/7.x/bottts/svg?seed=Alex', 'local'),
(4, 'devin.r@company.com', 'Devin R.', 'https://api.dicebear.com/7.x/bottts/svg?seed=Devin', 'local'),
(5, 'sarah.k@company.com', 'Sarah K.', 'https://api.dicebear.com/7.x/bottts/svg?seed=Sarah', 'local'),
(6, 'jennifer.j@company.com', 'Jennifer J.', 'https://api.dicebear.com/7.x/bottts/svg?seed=Jennifer', 'local')
ON CONFLICT (id) DO UPDATE SET 
  email = EXCLUDED.email, 
  name = EXCLUDED.name, 
  avatar_url = EXCLUDED.avatar_url;

SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

-- 2. Seed Projects
INSERT INTO projects (id, owner_id, name, description) VALUES
(1, 1, 'Sombok Express E-Commerce', 'High-throughput multi-vendor e-commerce platform with real-time inventory locks, Bakong KHQR checkout, and faceted product search.'),
(2, 1, 'PayFlow Digital Banking Gateway', 'Core financial transaction switch supporting multi-currency accounts, real-time fraud scoring, and instant inter-bank clearing.'),
(3, 1, 'CareFlow Telehealth & Clinic Management', 'HIPAA-compliant telemedicine platform with automated appointment booking, adaptive WebRTC video rooms, and encrypted EHR records.')
ON CONFLICT (id) DO UPDATE SET 
  owner_id = EXCLUDED.owner_id, 
  name = EXCLUDED.name, 
  description = EXCLUDED.description;

SELECT setval('projects_id_seq', (SELECT MAX(id) FROM projects));

-- 3. Seed Project Members (Per-Project Teams)
INSERT INTO project_members (project_id, user_id, role) VALUES
-- Sombok Express Team
(1, 1, 'owner'),
(1, 2, 'admin'),
(1, 3, 'member'),
(1, 4, 'member'),
(1, 5, 'member'),
(1, 6, 'member'),
-- PayFlow Banking Gateway Team
(2, 1, 'owner'),
(2, 2, 'admin'),
(2, 3, 'member'),
(2, 4, 'member'),
(2, 6, 'member'),
-- CareFlow Telehealth Team
(3, 1, 'owner'),
(3, 2, 'admin'),
(3, 4, 'member'),
(3, 5, 'member'),
(3, 6, 'member')
ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role;

-- 4. Seed Tags
INSERT INTO tags (id, name, color) VALUES
(1, 'backend', '#6366f1'),
(2, 'frontend', '#06b6d4'),
(3, 'security', '#f43f5e'),
(4, 'database', '#10b981'),
(5, 'performance', '#f59e0b'),
(6, 'bug', '#ef4444'),
(7, 'payment', '#8b5cf6'),
(8, 'devops', '#14b8a6'),
(9, 'compliance', '#ec4899')
ON CONFLICT (id) DO NOTHING;

SELECT setval('tags_id_seq', (SELECT MAX(id) FROM tags));

-- 5. Seed Tasks with Realistic Gantt Schedules, Estimates & Progress
INSERT INTO tasks (id, project_id, title, description, priority, status, creator, assignee, start_date, due_date, estimated_hours, progress) VALUES
-- ==========================================================
-- PROJECT 1: Sombok Express E-Commerce (Tasks 1 to 7)
-- ==========================================================
(1, 1, 'Implement Redis distributed lock for inventory checkout', 
 'Deploy Redlock algorithm with 15-minute TTL to reserve items during checkout and prevent flash sale overselling race conditions.', 
 'critical', 'closed', 'Piko', 'Alex V.', CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE - INTERVAL '2 days', 24.0, 100),

(2, 1, 'Integrate National Bank Bakong KHQR dynamic QR generation', 
 'Connect to Bakong Open API v2 to generate unified EMVCo-compliant KHQR payloads with instant deep-link routing for ABA, ACLEDA and Wing.', 
 'high', 'resolved', 'Piko', 'Pisey', CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE + INTERVAL '2 days', 28.0, 90),

(3, 1, 'Build faceted product catalog filter with price and category chips', 
 'Responsive sidebar filter component supporting multi-select attributes (Brand, Size, Color, Price Range) with URL query state syncing.', 
 'medium', 'in-progress', 'Sarah K.', 'Devin R.', CURRENT_DATE - INTERVAL '4 days', CURRENT_DATE + INTERVAL '4 days', 20.0, 65),

(4, 1, 'Address checkout session race condition under concurrent carts', 
 'Fix edge-case deadlock occurring when multiple shoppers purchase the last available SKU unit simultaneously within the same millisecond.', 
 'critical', 'in-progress', 'Piko', 'Alex V.', CURRENT_DATE - INTERVAL '2 days', CURRENT_DATE + INTERVAL '5 days', 18.0, 50),

(5, 1, 'Stress test inventory reservation with 10k synthetic users', 
 'Run k6 load test simulating 10,000 concurrent cart checkout requests to verify zero overselling and sub-350ms response times.', 
 'high', 'open', 'Devin R.', 'Jennifer J.', CURRENT_DATE + INTERVAL '1 day', CURRENT_DATE + INTERVAL '7 days', 16.0, 15),

(6, 1, 'Audit Payment Webhook HMAC SHA-256 signature verification', 
 'Ensure all incoming asynchronous payment confirmation webhooks from payment service providers are cryptographically validated against replay attacks.', 
 'high', 'closed', 'Pisey', 'Pisey', CURRENT_DATE - INTERVAL '12 days', CURRENT_DATE - INTERVAL '4 days', 14.0, 100),

(7, 1, 'Add Khmer phonetic typo tolerance to product search bar', 
 'Configure fuzzy search matching using trigrams and Levenshtein distance for Khmer script and romanized search inputs.', 
 'medium', 'open', 'Sarah K.', 'Devin R.', CURRENT_DATE + INTERVAL '2 days', CURRENT_DATE + INTERVAL '9 days', 16.0, 0),

-- ==========================================================
-- PROJECT 2: PayFlow Digital Banking Gateway (Tasks 8 to 12)
-- ==========================================================
(8, 2, 'Build double-entry ledger with immutable transaction hash chain', 
 'Implement immutable journal entry table where each record links cryptographically to prior hash block (SHA-256) preventing retroactive ledger tampering.', 
 'critical', 'closed', 'Piko', 'Piko', CURRENT_DATE - INTERVAL '14 days', CURRENT_DATE - INTERVAL '3 days', 32.0, 100),

(9, 2, 'Develop velocity rule engine for rapid micro-transaction detection', 
 'Implement sliding-window Redis counter to detect card testing botnets exceeding 5 transactions within 60 seconds from same IP/device fingerprint.', 
 'high', 'in-progress', 'Pisey', 'Devin R.', CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '3 days', 24.0, 70),

(10, 2, 'Implement Idempotency-Key header validation and replay cache', 
 'Intercept all debit/credit API mutations and return cached response payload on duplicate key submission within 24-hour TTL window.', 
 'high', 'resolved', 'Piko', 'Alex V.', CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE + INTERVAL '1 day', 20.0, 95),

(11, 2, 'Automate daily reconciliation CSV report parser for clearing house', 
 'Parse daily settlement files from Central Bank switch, detect discrepancy variances, and generate automated merchant payout schedules.', 
 'medium', 'open', 'Alex V.', 'Jennifer J.', CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE + INTERVAL '6 days', 18.0, 25),

(12, 2, 'Perform penetration test on HSM token exchange endpoints', 
 'Verify that Hardware Security Module key generation routines and TLS cipher suites resist downgrade attacks and unauthorized key extractions.', 
 'critical', 'open', 'Jennifer J.', 'Jennifer J.', CURRENT_DATE + INTERVAL '2 days', CURRENT_DATE + INTERVAL '10 days', 24.0, 0),

-- ==========================================================
-- PROJECT 3: CareFlow Telehealth Platform (Tasks 13 to 17)
-- ==========================================================
(13, 3, 'Implement WebRTC peer connection with Opus audio-only fallback', 
 'Configure STUN/TURN ICE servers with dynamic bandwidth detection to drop video track and maintain high-fidelity audio when bandwidth < 100kbps.', 
 'high', 'resolved', 'Piko', 'Pisey', CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE + INTERVAL '2 days', 26.0, 85),

(14, 3, 'Build encrypted EHR document upload with client-side key derivation', 
 'Encrypt sensitive patient health diagnosis files and lab reports using AES-256-GCM before transmitting to cloud object storage.', 
 'critical', 'closed', 'Piko', 'Piko', CURRENT_DATE - INTERVAL '12 days', CURRENT_DATE - INTERVAL '2 days', 28.0, 100),

(15, 3, 'Integrate automated Telegram appointment reminder bot with confirmation links', 
 'Schedule automated patient notifications 24 hours and 2 hours prior to consultation with one-click instant confirmation buttons.', 
 'medium', 'in-progress', 'Sarah K.', 'Devin R.', CURRENT_DATE - INTERVAL '3 days', CURRENT_DATE + INTERVAL '5 days', 18.0, 60),

(16, 3, 'Doctor schedule conflict resolution algorithm with buffer time windows', 
 'Prevent appointment overlaps across multiple clinic branches by enforcing automated 15-minute inter-consultation preparation buffers.', 
 'high', 'open', 'Devin R.', 'Alex V.', CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE + INTERVAL '7 days', 16.0, 30),

(17, 3, 'HIPAA compliance security audit and data access log inspector', 
 'Build tamper-evident administrative log viewer auditing every doctor, nurse and receptionist access to patient confidential records.', 
 'critical', 'open', 'Jennifer J.', 'Jennifer J.', CURRENT_DATE + INTERVAL '1 day', CURRENT_DATE + INTERVAL '8 days', 20.0, 0)

ON CONFLICT (id) DO UPDATE SET 
  project_id = EXCLUDED.project_id,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  priority = EXCLUDED.priority,
  status = EXCLUDED.status,
  creator = EXCLUDED.creator,
  assignee = EXCLUDED.assignee,
  start_date = EXCLUDED.start_date,
  due_date = EXCLUDED.due_date,
  estimated_hours = EXCLUDED.estimated_hours,
  progress = EXCLUDED.progress;

SELECT setval('tasks_id_seq', (SELECT MAX(id) FROM tasks));

-- 6. Seed Task-Tags (Many-to-Many)
INSERT INTO task_tags (task_id, tag_id) VALUES
-- Sombok Express E-Commerce
(1, 1), (1, 4), (1, 5),          -- Redis Lock: backend, database, performance
(2, 1), (2, 7), (2, 3),          -- Bakong KHQR: backend, payment, security
(3, 2), (3, 5),                  -- Faceted Filter: frontend, performance
(4, 1), (4, 4), (4, 6),          -- Race Condition: backend, database, bug
(5, 5), (5, 8),                  -- Stress Test: performance, devops
(6, 3), (6, 7), (6, 9),          -- Webhook Audit: security, payment, compliance
(7, 1), (7, 2),                  -- Khmer Search: backend, frontend

-- PayFlow Banking Gateway
(8, 1), (8, 4), (8, 9),          -- Double-Entry Ledger: backend, database, compliance
(9, 1), (9, 3), (9, 5),          -- Velocity Engine: backend, security, performance
(10, 1), (10, 5), (10, 7),       -- Idempotency: backend, performance, payment
(11, 4), (11, 7), (11, 9),       -- Reconciliation: database, payment, compliance
(12, 3), (12, 8), (12, 9),       -- HSM Pentest: security, devops, compliance

-- CareFlow Telehealth
(13, 2), (13, 5), (13, 8),       -- WebRTC: frontend, performance, devops
(14, 1), (14, 3), (14, 9),       -- Encrypted EHR: backend, security, compliance
(15, 1), (15, 2),                -- Telegram Bot: backend, frontend
(16, 1), (16, 4),                -- Doctor Schedule: backend, database
(17, 3), (17, 9)                 -- HIPAA Audit: security, compliance
ON CONFLICT DO NOTHING;

-- 7. Seed Task Dependencies (Gantt Schedule Critical Paths)
INSERT INTO task_dependencies (project_id, predecessor_id, successor_id, type, lag_days) VALUES
-- Sombok Express:
(1, 1, 4, 'FS', 0),  -- Redis Distributed Lock (Closed) -> Fix Race Condition (In Progress)
(1, 4, 5, 'FS', 1),  -- Fix Race Condition -> Stress Test Concurrency (FS +1d)
(1, 6, 2, 'FS', 0),  -- Webhook Signature Audit -> Bakong KHQR Integration (FS)
(1, 3, 7, 'SS', 0),  -- Faceted Product Catalog Filter -> Khmer Phonetic Search (SS)

-- PayFlow Banking:
(2, 8, 11, 'FS', 0), -- Double-Entry Ledger -> Daily Reconciliation CSV Parser (FS)
(2, 10, 9, 'SS', 0), -- Idempotency-Key Header -> Velocity Rule Engine (SS)
(2, 9, 12, 'FS', 1), -- Velocity Rule Engine -> HSM Penetration Test (FS +1d)

-- CareFlow Telehealth:
(3, 14, 17, 'FS', 0), -- Encrypted EHR Vault -> HIPAA Security Audit (FS)
(3, 16, 15, 'FS', 0), -- Schedule Conflict Algorithm -> Telegram Reminder Bot (FS)
(3, 13, 17, 'FF', 0)  -- WebRTC Tele-consultation -> HIPAA Compliance Audit (FF)
ON CONFLICT (predecessor_id, successor_id) DO UPDATE SET
  type = EXCLUDED.type,
  lag_days = EXCLUDED.lag_days;

-- 8. Seed Time Tracking Logs (Timesheets)
INSERT INTO time_logs (project_id, task_id, author, hours_spent, log_date, description) VALUES
-- Sombok Express Time Logs
(1, 1, 'Alex V.', 8.0, CURRENT_DATE - INTERVAL '8 days', 'Researched Redlock consensus and designed Redis key prefixing schema.'),
(1, 1, 'Alex V.', 8.0, CURRENT_DATE - INTERVAL '6 days', 'Implemented 15-minute lease expiration with auto-release on payment completion.'),
(1, 1, 'Alex V.', 8.0, CURRENT_DATE - INTERVAL '3 days', 'Executed unit tests under multi-threaded worker nodes; verified zero lock contention.'),
(1, 2, 'Pisey', 8.0, CURRENT_DATE - INTERVAL '5 days', 'Created Bakong HMAC payload signature generator with private RSA cert.'),
(1, 2, 'Pisey', 8.0, CURRENT_DATE - INTERVAL '3 days', 'Integrated dynamic QR generation endpoint with mobile app deep-linking.'),
(1, 2, 'Pisey', 4.0, CURRENT_DATE - INTERVAL '1 day', 'Tested ABA Mobile and ACLEDA scan-to-pay callbacks in sandbox.'),
(1, 3, 'Devin R.', 6.5, CURRENT_DATE - INTERVAL '3 days', 'Built responsive price slider and category filter pills in React.'),
(1, 3, 'Devin R.', 6.0, CURRENT_DATE - INTERVAL '1 day', 'Wired filter query parameters into browser URL search params for bookmarking.'),
(1, 4, 'Alex V.', 5.0, CURRENT_DATE - INTERVAL '1 day', 'Isolated race condition to unindexed database row lock during high checkout volume.'),
(1, 6, 'Pisey', 7.0, CURRENT_DATE - INTERVAL '10 days', 'Configured SHA-256 HMAC signature validator on payment callback endpoint.'),
(1, 6, 'Pisey', 7.0, CURRENT_DATE - INTERVAL '7 days', 'Simulated replay attack scenarios; verified 403 Forbidden rejection.'),

-- PayFlow Banking Time Logs
(2, 8, 'Piko', 8.0, CURRENT_DATE - INTERVAL '12 days', 'Designed double-entry bookkeeping schema: assets, liabilities, and merchant accounts.'),
(2, 8, 'Piko', 8.0, CURRENT_DATE - INTERVAL '9 days', 'Implemented cryptographically linked SHA-256 block hash for ledger immutability.'),
(2, 8, 'Piko', 8.0, CURRENT_DATE - INTERVAL '6 days', 'Benchmarked ledger insertion throughput under 10k transactions/sec.'),
(2, 8, 'Piko', 8.0, CURRENT_DATE - INTERVAL '4 days', 'Peer review with compliance officer; verified mathematical balance invariant.'),
(2, 9, 'Devin R.', 7.0, CURRENT_DATE - INTERVAL '4 days', 'Configured sliding-window token bucket in Redis cluster.'),
(2, 9, 'Devin R.', 8.0, CURRENT_DATE - INTERVAL '2 days', 'Added IP reputation lookup and geolocation anomaly detection rules.'),
(2, 10, 'Alex V.', 8.0, CURRENT_DATE - INTERVAL '5 days', 'Created Express middleware for Idempotency-Key header extraction and validation.'),
(2, 10, 'Alex V.', 6.0, CURRENT_DATE - INTERVAL '2 days', 'Stored response snapshots in Redis with 24h TTL; confirmed duplicate request safety.'),

-- CareFlow Telehealth Time Logs
(3, 13, 'Pisey', 8.0, CURRENT_DATE - INTERVAL '5 days', 'Deployed Coturn STUN/TURN server cluster for WebRTC peer relay.'),
(3, 13, 'Pisey', 8.0, CURRENT_DATE - INTERVAL '3 days', 'Implemented client-side network bandwidth observer and dynamic track muting.'),
(3, 14, 'Piko', 8.0, CURRENT_DATE - INTERVAL '10 days', 'Engineered client-side Web Cryptography API AES-256-GCM file encryption.'),
(3, 14, 'Piko', 8.0, CURRENT_DATE - INTERVAL '7 days', 'Implemented authenticated decryption streaming for doctor document viewing.'),
(3, 14, 'Piko', 6.0, CURRENT_DATE - INTERVAL '4 days', 'Completed security audit for zero plaintext leakage to disk storage.'),
(3, 15, 'Devin R.', 5.5, CURRENT_DATE - INTERVAL '2 days', 'Built Telegram Bot webhook with inline appointment confirmation keyboard.');

-- 9. Seed Comments
INSERT INTO comments (task_id, author, content) VALUES
(1, 'Alex V.', 'Redlock implementation deployed to staging. Lock acquisition latency is under 2.4ms.'),
(1, 'Piko', 'Approved! This guarantees zero inventory overselling during upcoming Flash Sale promotion.'),
(2, 'Pisey', 'Bakong dynamic QR generation tested with ABA Mobile sandbox. Instant webhook confirmed in 800ms.'),
(4, 'Alex V.', 'Reproduced the race condition by running 50 concurrent curl requests against SKU #104.'),
(6, 'Pisey', 'HMAC verification now strictly checks timestamp freshness within 300 seconds to prevent replay attacks.'),
(8, 'Piko', 'Ledger balances mathematically proven: sum(debit) == sum(credit) at all times.'),
(9, 'Devin R.', 'Rule engine flagged 42 synthetic card testing attempts during load test run.'),
(13, 'Pisey', 'WebRTC audio fallback successfully tested on throttled 2G connection (80 kbps). Call did not drop!'),
(14, 'Piko', 'Patient health records are client-side encrypted before payload reaches backend server.');

-- 10. Seed Task Activity / Audit History
INSERT INTO task_activities (task_id, actor, action_type, field_name, old_value, new_value, created_at) VALUES
(1, 'Piko', 'task_created', NULL, NULL, 'Implement Redis distributed lock for inventory checkout', CURRENT_TIMESTAMP - INTERVAL '10 days'),
(1, 'Alex V.', 'status_change', 'status', 'open', 'in-progress', CURRENT_TIMESTAMP - INTERVAL '8 days'),
(1, 'Alex V.', 'status_change', 'status', 'in-progress', 'closed', CURRENT_TIMESTAMP - INTERVAL '2 days'),
(2, 'Piko', 'task_created', NULL, NULL, 'Integrate National Bank Bakong KHQR dynamic QR generation', CURRENT_TIMESTAMP - INTERVAL '6 days'),
(2, 'Pisey', 'status_change', 'status', 'open', 'in-progress', CURRENT_TIMESTAMP - INTERVAL '5 days'),
(2, 'Pisey', 'status_change', 'status', 'in-progress', 'resolved', CURRENT_TIMESTAMP - INTERVAL '1 day'),
(4, 'Piko', 'task_created', NULL, NULL, 'Address checkout session race condition under concurrent carts', CURRENT_TIMESTAMP - INTERVAL '2 days'),
(4, 'Alex V.', 'status_change', 'status', 'open', 'in-progress', CURRENT_TIMESTAMP - INTERVAL '1 day'),
(8, 'Piko', 'task_created', NULL, NULL, 'Build double-entry ledger with immutable transaction hash chain', CURRENT_TIMESTAMP - INTERVAL '14 days'),
(8, 'Piko', 'status_change', 'status', 'in-progress', 'closed', CURRENT_TIMESTAMP - INTERVAL '3 days'),
(14, 'Piko', 'task_created', NULL, NULL, 'Build encrypted EHR document upload with client-side key derivation', CURRENT_TIMESTAMP - INTERVAL '12 days'),
(14, 'Piko', 'status_change', 'status', 'in-progress', 'closed', CURRENT_TIMESTAMP - INTERVAL '2 days');

-- 11. Seed Requirements Engineering & Traceability Matrix (RETM)
-- Framework: Problem -> Stakeholders/Needs -> Early NFRs -> Candidate Solution -> FRs/NFRs -> Tasks -> Validate
INSERT INTO project_requirements (id, project_id, code, title, type, category, business_problem, stakeholders, solution_concept, details, acceptance_criteria, priority, status, iteration_cycle) VALUES

-- ==========================================================
-- PROJECT 1: Sombok Express E-Commerce Requirements
-- ==========================================================
(1, 1, 'PROB-ECOM-01', 'Flash Sale Inventory Overselling & Race Conditions', 'problem', 'performance',
 'Under burst flash sales (e.g. 11.11 promo), multiple customers place orders for the same item at the same second. The database experiences race conditions, causing 22% of orders to be cancelled due to out-of-stock items, severely harming merchant reputation.',
 'Online Shoppers, Platform Merchants, Warehouse Fulfillment Operators. Pain point: severe customer dissatisfaction and payment refund overhead.',
 'Introduce a distributed atomic reservation mechanism (Redis Redlock with 15-minute checkout TTL) and PostgreSQL row-level locks before payment capture.',
 'The e-commerce system MUST guarantee that an item is atomically reserved when the user enters the checkout funnel, preventing any concurrent cart from purchasing the same stock unit.',
 'Zero overselling across 10,000 concurrent checkout attempts; reserved stock automatically returns to inventory pool if payment is not completed within 15 minutes.',
 'critical', 'approved', 1),

(2, 1, 'PROB-ECOM-02', 'High Cart Abandonment (68%) Due to Clunky Checkout & Payment Failures', 'problem', 'usability',
 'Shoppers abandon 68% of shopping carts at the final step because existing payment options require manual bank transfers or slow card processing without instant QR confirmation.',
 'End-User Shoppers, Sales VP, Finance Team. Need: friction-free, 1-click mobile payment with instant order confirmation.',
 'Implement unified checkout modal with Bakong KHQR dynamic QR generation, mobile deep-linking for ABA/ACLEDA/Wing, and tokenized card checkout.',
 'The checkout module MUST present customers with an instant dynamic KHQR code for mobile banking apps, processing payment verification asynchronously in under 2 seconds.',
 'Checkout completion rate increases by at least 25%; average checkout flow takes less than 20 seconds from cart to confirmed order.',
 'high', 'approved', 1),

(3, 1, 'NFR-SEC-01', 'PCI-DSS Compliance & HMAC Payment Webhook Verification', 'NFR', 'security',
 'Exposing raw payment callbacks to unauthenticated HTTP endpoints allows attackers to spoof payment confirmations and siphon goods without paying.',
 'Cybersecurity Architect, Chief Risk Officer, Compliance Auditors. Constraints: PCI-DSS Level 1 compliance, zero plaintext card data stored.',
 'All incoming webhook notifications MUST be validated using SHA-256 HMAC signatures with a shared secret, and timestamps verified within a 300-second freshness window.',
 'Payment callback service MUST verify cryptographic signatures and reject any request with invalid HMAC or expired timestamp with HTTP 403 Forbidden.',
 '100% of forged or modified webhook payloads are rejected; zero unauthorized orders marked as paid in production database.',
 'critical', 'validated', 1),

(4, 1, 'FR-INV-01', 'Real-Time Atomic Stock Reservation Engine (15-min TTL Hold)', 'FR', 'performance',
 'Need an exact functional mechanism to lock stock units immediately upon cart checkout initiation without blocking read queries.',
 'Backend Engineers, Warehouse Inventory System. Need: fast sub-5ms lock acquisition.',
 'Distributed Redis Redlock cluster paired with PostgreSQL `SELECT FOR UPDATE` on SKU records during order placement.',
 'The system MUST allocate a temporary reservation token for the selected SKU units for exactly 15 minutes, decreasing available inventory counter instantly.',
 'Stock counter decrements atomically; concurrent requests for zero-balance SKUs receive immediate "Out of Stock" notification without database lockups.',
 'critical', 'implemented', 2),

(5, 1, 'FR-PAY-01', 'Unified National Bakong KHQR Dynamic Generation & Instant Webhook Routing', 'FR', 'payment',
 'Customers require localized mobile banking QR payments compliant with the National Bank of Cambodia (NBC) KHQR standard.',
 'Khmer & International Shoppers, Finance Accounting. Need: instant payment receipt via mobile push.',
 'Integration with Bakong Open API v2 to generate dynamic EMVCo-compliant QR codes containing merchant ID, transaction ID, currency (USD/KHR), and exact amount.',
 'The payment subsystem MUST generate a valid dynamic KHQR within 500ms of user checkout action and listen for webhook settlement events from the central switch.',
 'Valid KHQR rendered with correct amount and currency; order status transitions automatically from "pending" to "paid" upon webhook receipt.',
 'high', 'validated', 2),

(6, 1, 'FR-CAT-01', 'Faceted Product Search & Multi-Attribute Filter Engine', 'FR', 'usability',
 'Shoppers struggle to browse through 50,000+ catalog items without multi-dimensional filtering by category, price range, brand, color, and customer rating.',
 'Shoppers, Merchandising Team, SEO Manager. Need: instant filter response without full-page reloads.',
 'Faceted search UI with dynamic category chips and URL query param synchronization (e.g. `?category=electronics&price_max=500`).',
 'The product directory MUST allow users to combine multiple filter criteria simultaneously, updating product grid results within 200ms.',
 'Filter state persists across page refreshes; selecting any combination of facets returns correct item subset matching all selected criteria.',
 'medium', 'in_review', 1),

-- ==========================================================
-- PROJECT 2: PayFlow Digital Banking Gateway Requirements
-- ==========================================================
(7, 2, 'PROB-FIN-01', 'Card Testing Botnets & Fraudulent Velocity Drains', 'problem', 'security',
 'Organized botnets launch automated micro-charge attacks testing stolen card credentials, causing bank network penalties and merchant balance chargebacks.',
 'Chief Risk Officer, Fraud Investigation Unit, Partner Banks. Constraints: zero false-positive rejections for legitimate high-volume merchants.',
 'Deploy a high-speed velocity detection engine utilizing sliding-window Redis counters and device fingerprinting to block anomalous bursts.',
 'The payment gateway MUST intercept and score every transaction request against real-time velocity rules before submitting to payment clearing networks.',
 'Block 99% of card testing bots within 3 attempts; legitimate transactions experience less than 15ms latency overhead.',
 'critical', 'approved', 1),

(8, 2, 'NFR-LEDGER-01', 'Cryptographic Immutable Double-Entry Ledger (WORM)', 'NFR', 'compliance',
 'Financial regulators mandate that all debit and credit movements must be permanently tamper-evident and auditable with mathematical zero-variance proof.',
 'Central Bank Regulators, External Financial Auditors, Treasury Lead. Constraints: SOC 2 Type II, ISO 27001.',
 'Every ledger transaction record includes a SHA-256 cryptographic hash chaining to the preceding entry (hash pointer), creating an immutable write-once ledger.',
 'The ledger architecture MUST enforce strict double-entry balancing where total debits equal total credits for every transaction batch, signed with a cryptographic block hash.',
 'Any unauthorized direct database row update invalidates the downstream hash chain and triggers automated security alerts; zero reconciliation discrepancies.',
 'critical', 'validated', 1),

(9, 2, 'FR-IDEMP-01', 'Sub-Second Idempotency Protocol & Webhook Re-delivery Queue', 'FR', 'reliability',
 'Network timeouts between merchant servers and payment gateway cause repeated payment retries, resulting in accidental double-charging of cardholders.',
 'Merchant Developers, Support Engineers, Cardholders. Need: safe retries without duplicate billing.',
 'Idempotency-Key HTTP header validation with distributed cache locking and PostgreSQL transactional outbox pattern.',
 'The API gateway MUST require an Idempotency-Key header on all payment initiation endpoints, caching and returning the exact identical response for any replayed key within 24 hours.',
 'Replaying identical request with the same Idempotency-Key returns original response within 20ms and creates exactly zero duplicate ledger entries.',
 'high', 'validated', 1),

-- ==========================================================
-- PROJECT 3: CareFlow Telehealth Platform Requirements
-- ==========================================================
(10, 3, 'PROB-HLT-01', 'Clinic Schedule Chaos, Overlapping Shifts & High Patient No-Shows (38%)', 'problem', 'usability',
 'Clinics lose substantial revenue due to patient no-shows and scheduling overlaps. Patients forget appointment dates without automated multi-channel reminders.',
 'Clinic Directors, Physicians, Outpatients. Pain point: wasted doctor time slots and frustrated patients waiting in queues.',
 'Smart scheduling calendar enforcing 15-minute inter-consultation preparation buffers, paired with automated Telegram/SMS reminder bots.',
 'The appointment engine MUST prevent doctor double-booking across multi-clinic branches and dispatch automated interactive confirmation prompts 24h and 2h prior to consultations.',
 'Patient no-show rate drops from 38% to under 10%; zero scheduling conflicts detected across 500+ weekly bookings.',
 'high', 'approved', 1),

(11, 3, 'NFR-HIPAA-01', 'End-to-End Encrypted Patient Health Records (EHR) Vault', 'NFR', 'security',
 'Medical diagnosis documents and prescription notes must comply with HIPAA and international patient privacy regulations, preventing unauthorized eavesdropping.',
 'Hospital Privacy Officer, Chief Medical Officer, Patients. Constraints: HIPAA Security Rule, zero plaintext storage on cloud servers.',
 'Client-side envelope encryption utilizing Web Cryptography API (AES-256-GCM) with physician-delegated key exchange.',
 'All medical attachments, blood tests, and physician clinical notes MUST be encrypted on the client device before transmission, accessible only by the assigned doctor and patient.',
 'Zero unencrypted health documents stored on S3/database; access log captures every doctor reading event with immutable timestamp and user ID.',
 'critical', 'validated', 1),

(12, 3, 'FR-WEBRTC-01', 'Adaptive Bitrate WebRTC Virtual Consultation Room (Opus Fallback)', 'FR', 'performance',
 'Rural patients on poor 3G/4G connections experience frozen video and disconnected calls during remote doctor consultations.',
 'Rural Patients, Remote Consulting Physicians, Telehealth Operators. Need: reliable uninterrupted audio communication even under severe network jitter.',
 'WebRTC peer-to-peer consultation rooms with Selective Forwarding Unit (SFU) adaptive bitrate streaming and instant audio-only fallback mode.',
 'The telehealth video room MUST dynamically monitor packet loss and frame rate, automatically dropping video streaming to maintain crisp Opus audio when bandwidth drops below 100kbps.',
 'Call drop rate remains below 1% even in rural areas with 40% packet loss; voice clarity remains intelligible at 80kbps bandwidth.',
 'high', 'implemented', 2),

(13, 2, 'FR-FRAUD-01', 'Real-Time Velocity Anomaly Detection & Card Risk Scoring', 'FR', 'security',
 'Card testing botnets rapidly test thousands of micro-transactions to validate stolen credit cards.',
 'Fraud Analysts, Risk Managers, Compliance Leads. Need: sub-10ms risk scoring before payment gateway forward.',
 'Redis sliding-window rate counters and device fingerprinting to detect repeated micro-transactions.',
 'The system MUST intercept and evaluate card velocity in real time, automatically blocking IP/cards exceeding 5 attempts per minute.',
 'Zero unauthorized card testing surges reach payment scheme; false positive rate < 0.1%.',
 'critical', 'in_review', 1),

(14, 3, 'FR-SCHED-01', 'Smart Calendar Booking with Telegram Bot Reminders', 'FR', 'usability',
 'Overlapping shifts across clinic branches and missing reminder notifications cause 38% patient no-show rates.',
 'Clinic Receptionists, Doctors, Patients. Need: instant booking confirmation and 24h/2h reminders.',
 'Multi-branch calendar scheduling engine integrated with automated Telegram and SMS confirmation bots.',
 'The booking module MUST enforce 15-minute inter-appointment buffers and dispatch interactive Telegram reminders with instant confirmation links.',
 'Patient no-show rate drops to under 10%; zero clinic doctor schedule conflicts.',
 'high', 'in_review', 1)

ON CONFLICT (id) DO UPDATE SET 
  project_id = EXCLUDED.project_id,
  code = EXCLUDED.code,
  title = EXCLUDED.title,
  type = EXCLUDED.type,
  category = EXCLUDED.category,
  business_problem = EXCLUDED.business_problem,
  stakeholders = EXCLUDED.stakeholders,
  solution_concept = EXCLUDED.solution_concept,
  details = EXCLUDED.details,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  priority = EXCLUDED.priority,
  status = EXCLUDED.status,
  iteration_cycle = EXCLUDED.iteration_cycle;

SELECT setval('project_requirements_id_seq', (SELECT MAX(id) FROM project_requirements));

-- 12. Seed Traceability Matrix (Requirements Linked to Implementation Tasks)
-- Note: "problem" type requirements have ZERO implementation tasks linked
-- Tasks strictly trace to Functional (FR) and Non-Functional (NFR) Requirements!
INSERT INTO requirement_tasks (requirement_id, task_id) VALUES
-- Sombok Express E-Commerce Traceability:
(3, 6), -- NFR-SEC-01 (PCI-DSS & Webhooks) -> Task #6: Audit Payment Webhook HMAC SHA-256 signature
(4, 1), -- FR-INV-01 (Stock Reservation Engine) -> Task #1: Implement Redis distributed lock
(4, 4), -- FR-INV-01 (Stock Reservation Engine) -> Task #4: Address checkout session race condition
(4, 5), -- FR-INV-01 (Stock Reservation Engine) -> Task #5: Stress test inventory reservation with 10k users
(5, 2), -- FR-PAY-01 (Bakong KHQR) -> Task #2: Integrate National Bank Bakong KHQR dynamic QR
(6, 3), -- FR-CAT-01 (Faceted Catalog Search) -> Task #3: Build faceted product catalog filter
(6, 7), -- FR-CAT-01 (Faceted Catalog Search) -> Task #7: Add Khmer phonetic typo tolerance

-- PayFlow Digital Banking Traceability:
(8, 8),   -- NFR-LEDGER-01 (Immutable Ledger) -> Task #8: Double-entry ledger with SHA-256 hash chain
(8, 11),  -- NFR-LEDGER-01 (Immutable Ledger) -> Task #11: Daily reconciliation CSV report parser
(9, 10),  -- FR-IDEMP-01 (Idempotency Protocol) -> Task #10: Idempotency-Key validation and replay cache
(13, 9),  -- FR-FRAUD-01 (Velocity Anomaly Detection) -> Task #9: Velocity rule engine for micro-transactions
(13, 12), -- FR-FRAUD-01 (Velocity Anomaly Detection) -> Task #12: HSM token exchange penetration test

-- CareFlow Telehealth Traceability:
(11, 14), -- NFR-HIPAA-01 (Encrypted EHR Vault) -> Task #14: Encrypted EHR document upload with AES-256
(11, 17), -- NFR-HIPAA-01 (Encrypted EHR Vault) -> Task #17: HIPAA compliance security audit
(12, 13), -- FR-WEBRTC-01 (Adaptive WebRTC) -> Task #13: WebRTC peer connection with Opus audio fallback
(14, 15), -- FR-SCHED-01 (Smart Calendar Booking) -> Task #15: Automated Telegram appointment reminder bot
(14, 16)  -- FR-SCHED-01 (Smart Calendar Booking) -> Task #16: Doctor schedule conflict resolution algorithm
ON CONFLICT (requirement_id, task_id) DO NOTHING;

-- 13. Seed Project Version History Snapshots (v1.0, v1.1, etc.)
INSERT INTO project_versions (id, project_id, version_tag, title, description, created_by, snapshot_data, metrics) VALUES
(1, 1, 'v1.0', 'Initial E-Commerce Core & Catalog MVP', 
 'Baseline release capturing product catalog structure, initial cart schema, and user authentication setup.', 
 'Piko',
 '{
   "captured_at": "2026-11-01T10:00:00.000Z",
   "project": {"id": 1, "name": "Sombok Express E-Commerce", "description": "High-throughput multi-vendor e-commerce platform"},
   "requirements_count": 3,
   "tasks_count": 4,
   "notes": "Baseline MVP Sprint before high concurrency flash sales architecture."
 }',
 '{
   "totalRequirements": 3,
   "functionalCount": 2,
   "nonFunctionalCount": 1,
   "coveragePercentage": 67,
   "validationPercentage": 33,
   "totalTasks": 4,
   "closedTasks": 2,
   "progressPercentage": 50
 }'),

(2, 1, 'v1.1', 'Bakong KHQR Payment & Redis Redlock Architecture', 
 'Milestone release introducing distributed stock reservation lock (15-min hold) and National Bank Bakong KHQR dynamic settlement.', 
 'Pisey',
 '{
   "captured_at": "2026-11-10T15:30:00.000Z",
   "project": {"id": 1, "name": "Sombok Express E-Commerce", "description": "High-throughput multi-vendor e-commerce platform with real-time inventory locks, Bakong KHQR checkout, and faceted product search."},
   "requirements_count": 6,
   "tasks_count": 7,
   "notes": "Full RETM traceability established across payment and inventory clusters."
 }',
 '{
   "totalRequirements": 6,
   "functionalCount": 3,
   "nonFunctionalCount": 1,
   "coveragePercentage": 100,
   "validationPercentage": 60,
   "totalTasks": 7,
   "closedTasks": 2,
   "progressPercentage": 45
 }'),

(3, 2, 'v1.0', 'Core Double-Entry Ledger & Idempotency Baseline', 
 'Initial production release enforcing zero-variance double-entry ledger with cryptographic SHA-256 block hashing.', 
 'Piko',
 '{
   "captured_at": "2026-11-05T09:00:00.000Z",
   "project": {"id": 2, "name": "PayFlow Digital Banking Gateway", "description": "Core financial transaction switch supporting multi-currency accounts and fraud scoring."},
   "requirements_count": 3,
   "tasks_count": 5,
   "notes": "Compliant with Central Bank immutable audit trail guidelines."
 }',
 '{
   "totalRequirements": 3,
   "functionalCount": 1,
   "nonFunctionalCount": 1,
   "coveragePercentage": 100,
   "validationPercentage": 67,
   "totalTasks": 5,
   "closedTasks": 1,
   "progressPercentage": 60
 }')
ON CONFLICT (id) DO UPDATE SET 
  project_id = EXCLUDED.project_id,
  version_tag = EXCLUDED.version_tag,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  created_by = EXCLUDED.created_by,
  snapshot_data = EXCLUDED.snapshot_data,
  metrics = EXCLUDED.metrics;

SELECT setval('project_versions_id_seq', (SELECT MAX(id) FROM project_versions));
