export interface AppConfig {
  port: number;
  databaseUrl: string | undefined;
  corsOrigin: string;
}

export function loadConfig(): AppConfig {
  return {
    port: Number(process.env.PORT ?? 8787),
    databaseUrl: process.env.DATABASE_URL || undefined,
    corsOrigin: process.env.CORS_ORIGIN ?? '*',
  };
}
