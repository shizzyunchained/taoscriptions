export const ACTIVE_LISTING_STATE_SQL = `
  l.cancelled_at IS NULL
  AND l.seller_account_hex = a.owner_account_hex
  AND l.ownership_nonce = a.ownership_nonce
  AND l.expiry_block > c.block_number
`;
