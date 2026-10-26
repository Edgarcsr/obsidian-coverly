import { normalizePath } from "obsidian";
import type { App } from "obsidian";

import { DEFAULT_SETTINGS } from "./settings";
import type { CoverlySettings } from "./settings";

/**
 * Configurações que descrevem como as notas desta vault aparecem (capas,
 * posição e cor dos ícones, fundos, ícones extras...). Ficam num arquivo na
 * pasta do Coverly no vault (`.coverly/settings.json`), não nas configurações
 * do plugin: assim acompanham a vault e sobrevivem a desinstalar e reinstalar,
 * como os ícones das pastas (ver folder-icons.ts).
 *
 * O que é do usuário ou do aparelho (idioma, chave do Unsplash, downloads,
 * último seletor aberto, ferramentas de desempenho...) continua nas
 * configurações do plugin. A pasta do Coverly também: é por ela que se acha
 * este arquivo.
 */
export const VAULT_SETTING_KEYS = [
  "colorPalette",
  "coverAnimation",
  "coverFade",
  "coverHeight",
  "coverRadius",
  "coverShade",
  "hiddenIconPacks",
  "iconPosition",
  "iconTrim",
  "linkIcons",
  "lucideExtras",
  "nameColors",
  "noteAccents",
  "noteBackgrounds",
  "treeBackgrounds",
  "treeIconPosition",
] as const satisfies readonly (keyof CoverlySettings)[];

export type VaultSettingKey = (typeof VAULT_SETTING_KEYS)[number];
export type VaultSettings = Pick<CoverlySettings, VaultSettingKey>;

const VAULT_SETTINGS_FILE = "settings.json";

const vaultSettingsPath = (folder: string): string =>
  normalizePath(`${folder}/${VAULT_SETTINGS_FILE}`);

/** O valor tem o tipo do padrão: um arquivo editado à mão não quebra as opções. */
const hasDefaultType = (key: VaultSettingKey, value: unknown): boolean => {
  const fallback = DEFAULT_SETTINGS[key];
  if (Array.isArray(fallback)) {
    return (
      Array.isArray(value) && value.every((item) => typeof item === "string")
    );
  }
  return typeof value === typeof fallback;
};

const isRecord = (data: unknown): data is Record<string, unknown> =>
  typeof data === "object" && data !== null && !Array.isArray(data);

const parseVaultSettings = (text: string): Partial<VaultSettings> => {
  const data: unknown = JSON.parse(text);
  const settings: Record<string, unknown> = {};
  if (!isRecord(data)) {
    return settings;
  }
  for (const key of VAULT_SETTING_KEYS) {
    const value: unknown = Object.getOwnPropertyDescriptor(data, key)?.value;
    if (hasDefaultType(key, value)) {
      settings[key] = value;
    }
  }
  return settings;
};

/** Só as opções da vault, copiadas das configurações. */
export const pickVaultSettings = (settings: CoverlySettings): VaultSettings => {
  const picked: Record<string, unknown> = {};
  for (const key of VAULT_SETTING_KEYS) {
    const value = settings[key];
    picked[key] = Array.isArray(value) ? [...value] : value;
  }
  return picked as VaultSettings;
};

/** As configurações sem as opções da vault: o que fica no `data.json`. */
export const omitVaultSettings = (
  settings: CoverlySettings
): Partial<CoverlySettings> => {
  const rest: Partial<CoverlySettings> = { ...settings };
  for (const key of VAULT_SETTING_KEYS) {
    Reflect.deleteProperty(rest, key);
  }
  return rest;
};

/**
 * Lê as opções gravadas na vault. Sem arquivo (ou ilegível), `null`: as
 * opções seguem como estão nas configurações do plugin (versões até a 0.9.1).
 */
export const readVaultSettings = async (
  app: App,
  folder: string
): Promise<Partial<VaultSettings> | null> => {
  const { adapter } = app.vault;
  const path = vaultSettingsPath(folder);
  try {
    if (!(await adapter.exists(path))) {
      return null;
    }
    return parseVaultSettings(await adapter.read(path));
  } catch {
    return null;
  }
};

/** Gravações em fila: uma mais antiga nunca sobrescreve uma mais nova. */
let pendingWrite: Promise<void> = Promise.resolve();
/** O que está gravado (pasta e texto), para não regravar o mesmo a cada salvamento. */
let lastWritten: string | null = null;

/** Grava as opções da vault. Lança se não conseguir, para quem chama manter as opções onde estavam. */
export const writeVaultSettings = async (
  app: App,
  folder: string,
  settings: VaultSettings
): Promise<void> => {
  const text = JSON.stringify(settings, null, "\t");
  const stamp = `${folder}\n${text}`;
  if (stamp === lastWritten) {
    await pendingWrite;
    return;
  }
  const previous = pendingWrite;
  const write = async (): Promise<void> => {
    try {
      await previous;
    } catch {
      // A anterior falhou: esta grava mesmo assim, com as opções de agora.
    }
    const { adapter } = app.vault;
    if (!(await adapter.exists(folder))) {
      await adapter.mkdir(folder);
    }
    await adapter.write(vaultSettingsPath(folder), text);
    lastWritten = stamp;
  };
  pendingWrite = write();
  await pendingWrite;
};
