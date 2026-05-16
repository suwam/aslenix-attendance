export function isMissingSupabaseTableError(error: unknown, tableName: string) {
  if (!error || typeof error !== "object") return false;

  const fields = error as { code?: string; message?: string };
  const message = fields.message ?? "";

  return (
    fields.code === "42P01" ||
    (message.includes(`'public.${tableName}'`) && message.includes("schema cache")) ||
    message.includes(`relation "public.${tableName}" does not exist`)
  );
}
