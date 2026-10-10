export type SocialProvider = 'github' | 'google'

const known: SocialProvider[] = ['github', 'google']

export const socialProviders = (import.meta.env.VITE_AUTH_SOCIAL_PROVIDERS || known.join(','))
  .split(',')
  .map((value) => value.trim())
  .filter((value): value is SocialProvider => known.includes(value as SocialProvider))
