import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pxqgwipcomwilmmhayng.supabase.co';
const SUPABASE_KEY = 'sb_publishable_XisOQAdPEY78uGgyxWV0vg_RXjDKuGn';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
