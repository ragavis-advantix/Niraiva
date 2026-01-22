-- Create performance index for health_parameters timeline queries
-- This enables efficient filtering by user_id and ordered by measured_at

CREATE INDEX IF NOT EXISTS idx_health_parameters_user_measured_at
ON health_parameters (user_id, measured_at DESC);

-- Additional indexes for common queries
CREATE INDEX IF NOT EXISTS idx_health_parameters_user_status
ON health_parameters (user_id, status);

CREATE INDEX IF NOT EXISTS idx_health_parameters_user_name
ON health_parameters (user_id, name);
