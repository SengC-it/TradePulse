import { timingSafeEqual } from "node:crypto";

const AUTHORIZATION_PREFIX = "Bearer ";

export function isAuthorizedCronRequest(
  request: Request,
  expectedSecret: string | undefined,
): boolean {
  if (!expectedSecret) {
    return false;
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith(AUTHORIZATION_PREFIX)) {
    return false;
  }

  const providedSecret = Buffer.from(
    authorization.slice(AUTHORIZATION_PREFIX.length),
  );
  const configuredSecret = Buffer.from(expectedSecret);

  if (providedSecret.length !== configuredSecret.length) {
    return false;
  }

  return timingSafeEqual(providedSecret, configuredSecret);
}
