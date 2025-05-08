// types.ts or directly in your useAuth.ts file
export type OAuthProviderType =
  | 'google'
  | 'discord'
  | 'twitter'
  | 'github'
  | 'spotify'
  | 'instagram'
  | 'tiktok'
  | 'linkedin'
  | 'apple';

export type LoginMethod =
  | 'email'
  | 'sms'
  | 'siwe'
  | 'siws'
  | 'farcaster'
  | OAuthProviderType
  | 'passkey'
  | 'telegram'
  | 'custom'
  | `privy:${string}`
  | 'guest';
