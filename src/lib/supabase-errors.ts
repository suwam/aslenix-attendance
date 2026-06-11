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

export function isMissingSupabaseColumnError(error: unknown, tableName: string, columnName: string) {
  if (!error || typeof error !== "object") return false;

  const fields = error as { code?: string; message?: string; details?: string };
  const text = `${fields.message ?? ""} ${fields.details ?? ""}`;

  return (
    fields.code === "42703" ||
    fields.code === "PGRST204" ||
    (text.includes(`'${columnName}'`) && text.includes(`'${tableName}'`) && text.includes("schema cache")) ||
    text.includes(`column "${columnName}" of relation "${tableName}" does not exist`)
  );
}
