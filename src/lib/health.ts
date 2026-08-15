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
};

export function createHealthPayload(input: {
  environment: string;
  version: string;
  databaseConfigured: boolean;
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
  };
}
