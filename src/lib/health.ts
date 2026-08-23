import { STRATEGY_VERSION } from "./config/constants.ts";

import type { AdvisoryHealth } from "./signal-advisory/types.ts";

export type HealthPayload = {
  status: "ok";
  service: "tradepulse";
  environment: string;
  version: string;
  database: {
    configuration: "configured" | "not_configured";
    connectivity: "not_checked";
  };
  trading: {
    enabled: false;
  };
  advisory: AdvisoryHealth;
};

export function createHealthPayload(input: {
  environment: string;
  version: string;
  databaseConfigured: boolean;
  advisory?: AdvisoryHealth;
}): HealthPayload {
  return {
    status: "ok",
    service: "tradepulse",
    environment: input.environment,
    version: input.version,
    database: {
      configuration: input.databaseConfigured ? "configured" : "not_configured",
      connectivity: "not_checked",
    },
    trading: {
      enabled: false,
    },
    advisory: input.advisory ?? {
      lastSuccessfulScan: null,
      lastEmailSent: null,
      lastError: null,
      strategyVersion: STRATEGY_VERSION,
    },
  };
}
