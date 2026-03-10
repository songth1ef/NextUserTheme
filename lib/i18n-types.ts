export interface I18nKeyDefinition {
  readonly key: string;
  readonly description: string;
  readonly category: string;
}

export interface UserLocalePack {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly translations: Record<string, string>;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface LocalePackInfo {
  readonly id: string;
  readonly name: string;
  readonly keyCount: number;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface UserLocaleManifest {
  readonly activePackId: string | null;
  readonly packs: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly createdAt: number;
    readonly updatedAt: number;
  }>;
}
