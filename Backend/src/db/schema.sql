-- Drop existing views first with cascade
DROP VIEW IF EXISTS issues CASCADE;
DROP VIEW IF EXISTS issue_dependencies CASCADE;
DROP VIEW IF EXISTS issue_tags CASCADE;
DROP VIEW IF EXISTS issue_activities CASCADE;

-- Drop existing tables with cascade
DROP TABLE IF EXISTS project_versions CASCADE;
DROP TABLE IF EXISTS requirement_tasks CASCADE;
DROP TABLE IF EXISTS project_requirements CASCADE;
DROP TABLE IF EXISTS task_dependencies CASCADE;
DROP TABLE IF EXISTS time_logs CASCADE;
DROP TABLE IF EXISTS project_invitations CASCADE;
DROP TABLE IF EXISTS project_members CASCADE;
DROP TABLE IF EXISTS task_tags CASCADE;
DROP TABLE IF EXISTS tags CASCADE;
DROP TABLE IF EXISTS task_activities CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS team_members CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users Table (OAuth Google / GitHub / Local)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    avatar_url TEXT,
    provider VARCHAR(50) NOT NULL DEFAULT 'local', -- 'google', 'github', 'local'
    provider_id VARCHAR(255),
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_users_is_demo ON users(is_demo);

-- Projects Table (Owned by a user)
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Project Members (Multi-Tenancy & Project Sharing)
CREATE TABLE project_members (
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member', -- 'owner', 'admin', 'member'
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (project_id, user_id)
);

-- Project Invitations (Sent to Gmail / Email with secure tokens)
CREATE TABLE project_invitations (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    inviter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invitee_email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    token VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'expired'
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tasks Table (ITPM & Agile Work Units) with Gantt Schedule Fields
CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(50) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in-progress', 'resolved', 'closed')),
    creator VARCHAR(100) NOT NULL,
    assignee VARCHAR(100),
    start_date DATE DEFAULT CURRENT_DATE,
    due_date DATE DEFAULT (CURRENT_DATE + INTERVAL '7 days'),
    estimated_hours NUMERIC(6,2) DEFAULT 8.0,
    progress INT DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Time Tracking & Labor Hours Table
CREATE TABLE time_logs (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    author VARCHAR(100) NOT NULL,
    hours_spent NUMERIC(6,2) NOT NULL CHECK (hours_spent > 0),
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ITPM Task Dependencies Table (FS: Finish-to-Start, SS: Start-to-Start, FF: Finish-to-Finish, SF: Start-to-Finish)
CREATE TABLE task_dependencies (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    predecessor_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    successor_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    type VARCHAR(10) NOT NULL DEFAULT 'FS' CHECK (type IN ('FS', 'SS', 'FF', 'SF')),
    lag_days INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_no_self_dependency CHECK (predecessor_id <> successor_id),
    CONSTRAINT uq_pred_succ UNIQUE (predecessor_id, successor_id)
);

-- Comments Table with Foreign Key ON DELETE CASCADE
CREATE TABLE comments (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    author VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Task Activity / Audit Log Table with Foreign Key ON DELETE CASCADE
CREATE TABLE task_activities (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    actor VARCHAR(100) NOT NULL,
    action_type VARCHAR(50) NOT NULL, -- 'task_created', 'status_change', 'priority_change', 'assignee_change', 'comment_added', 'work_logged', etc.
    field_name VARCHAR(50),
    old_value TEXT,
    new_value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tags Table for Many-to-Many Categorization
CREATE TABLE tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    color VARCHAR(25) NOT NULL DEFAULT '#6366f1'
);

-- Junction Table for Tasks <-> Tags (Many-to-Many)
CREATE TABLE task_tags (
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (task_id, tag_id)
);

-- ==========================================================
-- ITPM & SE REQUIREMENTS ENGINEERING & TRACEABILITY MATRIX
-- Chain: Problem -> Stakeholders/Needs -> Goals/Early NFRs -> Solution -> FRs/NFRs -> Tasks -> Validate
-- ==========================================================
CREATE TABLE project_requirements (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL, -- e.g. 'FR-01', 'NFR-01', 'PROB-01'
    title VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'FR' CHECK (type IN ('problem', 'stakeholder_need', 'FR', 'NFR', 'solution_spec')),
    category VARCHAR(50) DEFAULT 'general', -- 'general', 'security', 'performance', 'compliance', 'usability', 'reliability', 'budget'
    business_problem TEXT, -- Who has the problem & what is the root pain point
    stakeholders TEXT, -- Target stakeholders, personas & constraints
    solution_concept TEXT, -- Proposed candidate solution / approach
    details TEXT NOT NULL, -- Exact requirement statement (What the system MUST do / How well)
    acceptance_criteria TEXT, -- Verification & validation criteria against original problem
    priority VARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'approved', 'implemented', 'validated')),
    iteration_cycle INT DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Junction Table: Traceability Matrix (Requirements <-> Implementation Tasks)
CREATE TABLE requirement_tasks (
    requirement_id INTEGER NOT NULL REFERENCES project_requirements(id) ON DELETE CASCADE,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (requirement_id, task_id)
);

-- Project Versions & Architecture Snapshot Table (v1.0, v1.1, etc.)
CREATE TABLE project_versions (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version_tag VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_by VARCHAR(100) NOT NULL,
    snapshot_data JSONB NOT NULL,
    metrics JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_proj_version UNIQUE (project_id, version_tag)
);

-- ==========================================================
-- BACKWARD COMPATIBILITY VIEWS (Zero-Break Migration Layer)
-- ==========================================================
CREATE OR REPLACE VIEW issues AS SELECT * FROM tasks;
CREATE OR REPLACE VIEW issue_dependencies AS SELECT * FROM task_dependencies;
CREATE OR REPLACE VIEW issue_tags AS SELECT task_id AS issue_id, tag_id, created_at FROM task_tags;
CREATE OR REPLACE VIEW issue_activities AS SELECT id, task_id AS issue_id, actor, action_type, field_name, old_value, new_value, created_at FROM task_activities;

-- Performance Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_projects_owner_id ON projects(owner_id);
CREATE INDEX idx_project_members_user_id ON project_members(user_id);
CREATE INDEX idx_project_members_project_id ON project_members(project_id);
CREATE INDEX idx_project_invitations_token ON project_invitations(token);
CREATE INDEX idx_project_invitations_email ON project_invitations(invitee_email);
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_assignee ON tasks(assignee);
CREATE INDEX idx_time_logs_project_date ON time_logs(project_id, log_date);
CREATE INDEX idx_time_logs_task ON time_logs(task_id);
CREATE INDEX idx_comments_task_id ON comments(task_id);
CREATE INDEX idx_task_activities_task_id ON task_activities(task_id);
CREATE INDEX idx_task_tags_task_id ON task_tags(task_id);
CREATE INDEX idx_task_tags_tag_id ON task_tags(tag_id);
CREATE INDEX idx_task_deps_project_id ON task_dependencies(project_id);
CREATE INDEX idx_task_deps_predecessor ON task_dependencies(predecessor_id);
CREATE INDEX idx_task_deps_successor ON task_dependencies(successor_id);
CREATE INDEX idx_proj_reqs_project_id ON project_requirements(project_id);
CREATE INDEX idx_proj_reqs_type ON project_requirements(type);
CREATE INDEX idx_proj_reqs_status ON project_requirements(status);
CREATE INDEX idx_req_tasks_req_id ON requirement_tasks(requirement_id);
CREATE INDEX idx_req_tasks_task_id ON requirement_tasks(task_id);
CREATE INDEX idx_proj_versions_project_id ON project_versions(project_id);
CREATE INDEX idx_proj_versions_tag ON project_versions(version_tag);
