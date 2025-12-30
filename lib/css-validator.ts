import postcss from "postcss";
import valueParser from "postcss-value-parser";
import type { ValidationError, ValidationResult } from "@/lib/types";

const forbiddenSelectors: readonly string[] = [
  "body",
  "html",
  "*",
  "html *",
  "body *",
  "[style]",
  "script",
  "iframe",
  "object",
  "embed"
];

const forbiddenAtRules: readonly string[] = [
  "import",
  "font-face",
  "charset",
  "namespace",
  "keyframes",
  "media",
  "supports"
];

const isAllowedSelector = (rawSelector: string): boolean => {
  const selector = rawSelector.trim();
  if (selector.length === 0) return false;
  if (/^:root\s*$/i.test(selector)) return true;
  if (/^\.user-theme(\s|$)/i.test(selector)) return true;
  return false;
};

const splitSelectors = (selectorText: string): readonly string[] => {
  const parts = selectorText.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
  return parts;
};

const toError = (input: {
  type: ValidationError["type"];
  message: string;
  line?: number;
  column?: number;
}): ValidationError => {
  return { type: input.type, message: input.message, line: input.line, column: input.column };
};

const getNodeLocation = (node: { source?: { start?: { line?: number; column?: number } } }): { line?: number; column?: number } => {
  const line = node.source?.start?.line;
  const column = node.source?.start?.column;
  return { line, column };
};

const isForbiddenSelector = (rawSelector: string): boolean => {
  const selector = rawSelector.trim().toLowerCase();
  if (forbiddenSelectors.includes(selector)) return true;
  return false;
};

const hasUrlFunction = (value: string): boolean => {
  const parsed = valueParser(value);
  let found = false;
  parsed.walk((node) => {
    if (node.type === "function" && node.value.toLowerCase() === "url") {
      found = true;
      return false;
    }
    return undefined;
  });
  return found;
};

const isForbiddenDecl = (input: { prop: string; value: string; selectorHint?: string }): string | null => {
  const prop = input.prop.trim().toLowerCase();
  const value = input.value.trim();
  const valueLower = value.toLowerCase();
  if (hasUrlFunction(valueLower)) return `禁止外部资源：检测到 url()`;
  if (prop === "position") {
    const firstToken = valueParser(valueLower).nodes.find((n) => n.type === "word")?.value ?? "";
    if (firstToken === "fixed" || firstToken === "sticky") return `禁止属性：position: ${firstToken}`;
    return null;
  }
  if (prop === "z-index") {
    const firstToken = valueParser(valueLower).nodes.find((n) => n.type === "word")?.value ?? "";
    const num = Number.parseInt(firstToken, 10);
    if (!Number.isNaN(num) && num > 1000) return `禁止属性：z-index > 1000（当前 ${num}）`;
    return null;
  }
  if (prop === "content") return "禁止属性：content";
  if (prop === "behavior") return "禁止属性：behavior";
  if (prop === "expression") return "禁止属性：expression";
  if (prop === "display") {
    if ((input.selectorHint ?? "").trim().toLowerCase() === ":root" && valueLower === "none") return "禁止规则：:root 上不允许 display: none";
    return null;
  }
  return null;
};

export function validateUserCss(cssText: string): ValidationResult {
  const errors: ValidationError[] = [];
  if (typeof cssText !== "string" || cssText.trim().length === 0) {
    return { valid: false, errors: [toError({ type: "other", message: "CSS 为空" })] };
  }
  let root: postcss.Root;
  try {
    root = postcss.parse(cssText);
  } catch (error) {
    const message = error instanceof Error ? error.message : "CSS 解析失败";
    return { valid: false, errors: [toError({ type: "other", message })] };
  }
  root.walkAtRules((atRule) => {
    const name = atRule.name.toLowerCase();
    if (!forbiddenAtRules.includes(name)) return;
    const loc = getNodeLocation(atRule);
    errors.push(toError({ type: "at-rule", message: `禁止使用 @${atRule.name}`, line: loc.line, column: loc.column }));
  });
  root.walkRules((rule) => {
    const selectorText = rule.selector ?? "";
    const selectors = splitSelectors(selectorText);
    for (const selector of selectors) {
      if (isForbiddenSelector(selector)) {
        const loc = getNodeLocation(rule);
        errors.push(toError({ type: "selector", message: `禁止全局/危险选择器：${selector}`, line: loc.line, column: loc.column }));
        continue;
      }
      if (!isAllowedSelector(selector)) {
        const loc = getNodeLocation(rule);
        errors.push(toError({ type: "selector", message: `只允许 :root 或 .user-theme 作用域选择器（当前：${selector}）`, line: loc.line, column: loc.column }));
      }
    }
  });
  root.walkDecls((decl) => {
    const parent = decl.parent;
    const selectorHint = parent && "selector" in parent ? String((parent as postcss.Rule).selector ?? "") : undefined;
    const violation = isForbiddenDecl({ prop: decl.prop, value: decl.value, selectorHint: selectorHint ? selectorHint.trim() : undefined });
    if (!violation) return;
    const loc = getNodeLocation(decl);
    errors.push(toError({ type: "property", message: violation, line: loc.line, column: loc.column }));
  });
  return { valid: errors.length === 0, errors };
}

