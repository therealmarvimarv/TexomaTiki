
-- Transactional client deletion RPC for platform admins.
-- Deletes all platform-dashboard records for a client in dependency order.
-- Does NOT touch external Supabase projects, Netlify sites, or client app databases.
CREATE OR REPLACE FUNCTION platform_delete_client(p_client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Require authenticated caller (platform admins must be signed in)
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: must be authenticated to delete a client';
  END IF;

  -- Verify the client exists
  IF NOT EXISTS (SELECT 1 FROM platform_clients WHERE id = p_client_id) THEN
    RAISE EXCEPTION 'Client not found';
  END IF;

  -- Delete records that reference instances only (no client_id column)
  DELETE FROM platform_update_job_targets
    WHERE instance_id IN (SELECT id FROM platform_instances WHERE client_id = p_client_id);

  DELETE FROM platform_provisioning_steps
    WHERE instance_id IN (SELECT id FROM platform_instances WHERE client_id = p_client_id);

  DELETE FROM platform_generated_setup_tasks
    WHERE instance_id IN (SELECT id FROM platform_instances WHERE client_id = p_client_id);

  DELETE FROM platform_instance_env_requirements
    WHERE instance_id IN (SELECT id FROM platform_instances WHERE client_id = p_client_id);

  -- Delete all records with direct client_id FK (covers both client-only and client+instance rows)
  DELETE FROM platform_alerts WHERE client_id = p_client_id;
  DELETE FROM platform_client_handoffs WHERE client_id = p_client_id;
  DELETE FROM platform_client_lifecycle_events WHERE client_id = p_client_id;
  DELETE FROM platform_client_lifecycle WHERE client_id = p_client_id;
  DELETE FROM platform_client_subscriptions WHERE client_id = p_client_id;
  DELETE FROM platform_instance_access_events WHERE client_id = p_client_id;
  DELETE FROM platform_instance_domains WHERE client_id = p_client_id;
  DELETE FROM platform_instance_health_checks WHERE client_id = p_client_id;
  DELETE FROM platform_instance_launch_packages WHERE client_id = p_client_id;
  DELETE FROM platform_provisioning_jobs WHERE client_id = p_client_id;
  DELETE FROM platform_stripe_webhook_events WHERE related_client_id = p_client_id;
  DELETE FROM platform_support_access_logs WHERE client_id = p_client_id;
  DELETE FROM platform_support_tickets WHERE client_id = p_client_id;

  -- Delete instances
  DELETE FROM platform_instances WHERE client_id = p_client_id;

  -- Delete the client record itself
  DELETE FROM platform_clients WHERE id = p_client_id;
END;
$$;

REVOKE ALL ON FUNCTION platform_delete_client(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform_delete_client(uuid) TO authenticated;
