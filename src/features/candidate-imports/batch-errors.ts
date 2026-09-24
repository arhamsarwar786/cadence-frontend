/** Map batch-level validation errors to staff-facing guidance. */
export function describeImportBatchError(error: string | null | undefined): string | null {
  if (!error?.trim()) return null;
  const normalized = error.trim().toLowerCase();
  if (normalized.includes("could not unwrap the package key")) {
    return (
      "This package was encrypted for a different environment or organization. " +
      "On Candidate imports, use “Create sample package” (locks the file with this server's key and your org), " +
      "then upload that .migpkg — do not use repo fixtures or packages built on another machine."
    );
  }
  if (normalized.includes("integrity") || normalized.includes("authenticity")) {
    return "The package failed its integrity check — it may be corrupted or encrypted for another organization.";
  }
  return error.trim();
}
