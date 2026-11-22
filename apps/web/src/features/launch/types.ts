/** Row of public.tokens (supabase/migrations/0001_tokens.sql). */
export interface TokenRow {
  address: string;
  creator: string;
  name: string;
  symbol: string;
  total_supply: string;
  description: string;
  image_url: string;
  website: string | null;
  x_url: string | null;
  telegram: string | null;
  discord: string | null;
  metadata_uri: string;
  tx_hash: string;
  block_number: number;
  created_at: string;
}
