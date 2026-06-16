-- Rename service_type enum values to match ServiceType from @agentepro/shared-types
-- PostgreSQL 10+ supports ALTER TYPE ... RENAME VALUE
ALTER TYPE service_type RENAME VALUE 'WEBSITE' TO 'SITE_CREATION';
ALTER TYPE service_type RENAME VALUE 'TRAFFIC' TO 'TRAFFIC_MANAGEMENT';
ALTER TYPE service_type RENAME VALUE 'OTHER' TO 'FULL_DIGITAL';
-- 'SOCIAL_MEDIA' unchanged
