-- ============================================================================
-- Barack Mercosul — Admin Panel: user roles + admin functions
-- Apply via: supabase db push  OR  Supabase dashboard SQL editor
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. user_roles table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_roles (
    user_id  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role     TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Admins can read/write all roles
CREATE POLICY "admins_manage_roles" ON user_roles
    FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
    );

-- Any authenticated user can read their own role
CREATE POLICY "users_read_own_role" ON user_roles
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. is_admin() — check if current user is admin
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
    );
$$;

GRANT EXECUTE ON FUNCTION is_admin TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. admin_list_users() — list all users with roles (admin only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION admin_list_users()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: admin access required';
    END IF;

    SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO result
    FROM (
        SELECT
            u.id,
            u.email,
            u.raw_user_meta_data->>'display_name' AS display_name,
            u.created_at,
            u.last_sign_in_at,
            u.banned_until,
            COALESCE(r.role, 'user') AS role
        FROM auth.users u
        LEFT JOIN user_roles r ON r.user_id = u.id
    ) t;

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_list_users TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. admin_toggle_user(target_user_id, ban) — ban/unban a user (admin only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION admin_toggle_user(target_user_id UUID, ban BOOLEAN)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: admin access required';
    END IF;

    -- Cannot deactivate yourself
    IF target_user_id = auth.uid() THEN
        RAISE EXCEPTION 'No podés desactivar tu propia cuenta';
    END IF;

    IF ban THEN
        UPDATE auth.users SET banned_until = '2099-12-31T23:59:59Z'::timestamptz
        WHERE id = target_user_id;
    ELSE
        UPDATE auth.users SET banned_until = NULL
        WHERE id = target_user_id;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_toggle_user TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. admin_set_role(target_user_id, new_role) — change a user's role
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION admin_set_role(target_user_id UUID, new_role TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: admin access required';
    END IF;

    IF new_role NOT IN ('admin', 'user') THEN
        RAISE EXCEPTION 'Rol inválido: %', new_role;
    END IF;

    -- Cannot demote yourself
    IF target_user_id = auth.uid() AND new_role = 'user' THEN
        RAISE EXCEPTION 'No podés quitarte el rol de admin a vos mismo';
    END IF;

    INSERT INTO user_roles (user_id, role, updated_at)
    VALUES (target_user_id, new_role, NOW())
    ON CONFLICT (user_id) DO UPDATE SET role = new_role, updated_at = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION admin_set_role TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Seed: admin@barack.com as admin
-- ---------------------------------------------------------------------------
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'admin@barack.com'
ON CONFLICT (user_id) DO NOTHING;
