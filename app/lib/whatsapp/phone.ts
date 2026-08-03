export function normalizePhoneNumber(input: string): string {
  return input.replace(/[^\d+]/g, "");
}
