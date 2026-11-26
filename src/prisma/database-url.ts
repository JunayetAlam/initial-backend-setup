/**
 * Returns DATABASE_URL, or builds it from the POSTGRES_* variables that
 * docker-compose uses. Shared by the app and the Prisma CLI.
 */
export function resolveDatabaseUrl(
  get: (key: string) => string | undefined,
): string | undefined {
  const url = get('DATABASE_URL');
  if (url) return url;

  const slug = get('PROJECT_SLUG');
  const user = get('POSTGRES_USER');
  const password = get('POSTGRES_PASSWORD');
  const port = get('POSTGRES_PORT');
  const host = get('POSTGRES_HOST') || 'localhost';
  if (!slug || !user || !password || !port) return undefined;

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${slug}?schema=public`;
}
