export type ValidationErrorType = "selector" | "property" | "at-rule" | "other";

export interface ValidationError {
  readonly type: ValidationErrorType;
  readonly message: string;
  readonly line?: number;
  readonly column?: number;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ValidationError[];
}

export interface UserCssRecord {
  readonly version: string;
  readonly css: string;
  readonly hash: string;
  readonly createdAt: number;
  readonly userId?: string;
}

