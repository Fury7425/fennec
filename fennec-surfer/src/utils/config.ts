import { readFile } from 'node:fs/promises';
import { resolve }  from 'node:path';
import { z }        from 'zod';

// ─── Schema ───────────────────────────────────────────────────────────────────

const BrandingSchema = z.object({
  productName:  z.string(),
  companyName:  z.string(),
  appId:        z.string(),
  tagline:      z.string(),
  homepage:     z.string().url(),
  newTabUrl:    z.string(),
  settingsUrl:  z.string(),
  setupUrl:     z.string(),
});

const ChannelSchema = z.object({
  name:      z.string(),
  version:   z.string(),
  channel:   z.enum(['stable', 'nightly', 'beta']),
  updateUrl: z.string().url(),
  branding:  BrandingSchema,
  icons:     z.record(z.string()),
});

export const SurferConfigSchema = z.object({
  chromium: z.object({
    version:             z.string(),
    ungoogled_revision:  z.string(),
    source:              z.string(),
  }),
  channels: z.object({
    release: ChannelSchema,
    nightly: ChannelSchema,
  }),
  patches: z.object({
    seriesFile:      z.string(),
    coreDir:         z.string(),
    vendorDir:       z.string(),
    validateOnApply: z.boolean(),
  }),
  build: z.object({
    gnArgs:            z.record(z.union([z.string(), z.boolean(), z.number()])),
    platformOverrides: z.record(z.record(z.union([z.string(), z.boolean(), z.number()]))),
  }),
  package: z.record(z.object({
    type:            z.string(),
    signingIdentity: z.string().optional(),
    signingCert:     z.string().optional(),
    arch:            z.array(z.string()).optional(),
  })),
  devutils: z.record(z.string()),
});

export type SurferConfig = z.infer<typeof SurferConfigSchema>;

// ─── Loader ───────────────────────────────────────────────────────────────────

export async function loadSurferConfig(
  configPath?: string
): Promise<SurferConfig> {
  const path = configPath ?? resolve(process.cwd(), 'surfer.json');
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch {
    throw new Error(
      `[fennec-surfer] Could not read surfer.json at ${path}.\n` +
      `Run this command from the root of the Fennec repository.`
    );
  }

  const parsed = SurferConfigSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error(
      `[fennec-surfer] surfer.json validation failed:\n` +
      parsed.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n')
    );
  }
  return parsed.data;
}
