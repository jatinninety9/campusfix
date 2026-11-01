CREATE TABLE issue_attachments (
    id UUID PRIMARY KEY,
    issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    object_key TEXT NOT NULL UNIQUE,
    original_name TEXT NOT NULL,
    content_type TEXT NOT NULL
        CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
    size_bytes INTEGER NOT NULL
        CHECK (size_bytes > 0 AND size_bytes <= 5242880),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX issue_attachments_issue_id_idx
    ON issue_attachments(issue_id);
