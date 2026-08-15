export type ScanRunStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCEEDED"
  | "PARTIAL"
  | "FAILED";

export type ScanRunAction =
  | "CREATE"
  | "SKIP_COMPLETED"
  | "SKIP_IN_PROGRESS"
  | "RETRY_EXISTING";

type ExistingScanRun = {
  status: ScanRunStatus;
  leaseExpiresAt: Date | string | null;
};

export function buildHourlyScanRunKey(scheduledFor: Date | string): string {
  const cycle = new Date(scheduledFor);

  if (Number.isNaN(cycle.getTime())) {
    throw new Error("scheduledFor must be a valid date");
  }

  cycle.setUTCMinutes(0, 0, 0);

  return `hourly-1h:${cycle.toISOString()}`;
}

export function decideScanRunAction(input: {
  existing: ExistingScanRun | null;
  now: Date | string;
}): ScanRunAction {
  if (input.existing === null) {
    return "CREATE";
  }

  if (input.existing.status === "SUCCEEDED") {
    return "SKIP_COMPLETED";
  }

  if (input.existing.status === "FAILED" || input.existing.status === "PARTIAL") {
    return "RETRY_EXISTING";
  }

  const now = new Date(input.now);
  const leaseExpiresAt = input.existing.leaseExpiresAt
    ? new Date(input.existing.leaseExpiresAt)
    : null;

  if (leaseExpiresAt !== null && leaseExpiresAt <= now) {
    return "RETRY_EXISTING";
  }

  return "SKIP_IN_PROGRESS";
}
