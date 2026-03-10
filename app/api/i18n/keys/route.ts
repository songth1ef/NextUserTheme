import { i18nKeys } from "@/locales/keys";

export async function GET(): Promise<Response> {
  return Response.json({ keys: i18nKeys });
}
