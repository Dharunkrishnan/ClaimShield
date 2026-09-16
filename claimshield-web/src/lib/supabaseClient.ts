import { createClient } from '@supabase/supabase-js'

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://foludfihdtbxxkqzszmi.supabase.co'
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_7M-NSOytK7WD1qCNS7H2xQ_cAJ-ABZI'

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set (see .env.example).',
  )
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

console.log("Supabase URL:", supabaseUrl)
console.log(
  "Supabase key loaded:",
  !!supabasePublishableKey,
  "prefix:",
  supabasePublishableKey?.substring(0, 15)
)
