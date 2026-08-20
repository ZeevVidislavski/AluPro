import { supabase } from './client';

// Self-service only — profiles_update_self (0001_poc_core.sql) restricts
// writes to id = auth.uid(), so there is no tenant_id/userId parameter
// here on purpose; the RLS policy is what actually enforces "own profile
// only", this just mirrors that shape.
export const ProfileService = {
  async getSelf() {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (error) throw error;
    return data;
  },

  async updateSelf(fields) {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    const { data, error } = await supabase
      .from('profiles')
      .update(fields)
      .eq('id', user.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
