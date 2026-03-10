import { getBuiltinTranslations } from "@/lib/server/locale-store";

export async function GET(): Promise<Response> {
  return Response.json({ translations: getBuiltinTranslations() });
}
