import { supabase } from '@/lib/supabaseClient';

export { supabase };

// Shared helper: every "list"/"filter" style query on a soft-deletable
// table must exclude deleted rows explicitly in the Service Layer too,
// not just rely on RLS (defense in depth — see SUPABASE_SCHEMA_PLAN.md
// section 6.1).
export const excludeDeleted = (query) => query.is('deleted_at', null);
