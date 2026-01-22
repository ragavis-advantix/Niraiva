-- 004_chat_tables.sql

-- ============================================================
-- CHAT SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patient_master(id) ON DELETE CASCADE,
  timeline_event_id UUID REFERENCES timeline_events(id) ON DELETE CASCADE,
  allowed_followups JSONB, -- list of allowed question types
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_chat_sessions_patient ON chat_sessions(patient_id);
CREATE INDEX idx_chat_sessions_event ON chat_sessions(timeline_event_id);

-- ============================================================
-- CHAT MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  llm_used TEXT, -- e.g., 'mistral', 'qwen', 'nvidia'
  followup_type TEXT, -- e.g., 'parameter_explanation', 'trend_comparison'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_created ON chat_messages(created_at);

-- ============================================================
-- COMMENTS
-- ============================================================
COMMENT ON TABLE chat_sessions IS 'Stores chat context derived from a timeline event.';
COMMENT ON TABLE chat_messages IS 'History of interactions for a chat session, with audit trail of LLM used.';
