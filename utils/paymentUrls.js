const trimTrailingSlash = (value = "") => value.replace(/\/+$/, "");

const inferBackendBaseUrl = (req) => {
  if (!req) return "";
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.get("host");
  if (!host) return "";
  return `${protocol}://${host}`;
};

exports.getPaymentUrls = (req) => {
  const backendBaseUrl = trimTrailingSlash(
    process.env.BACKEND_BASE_URL || inferBackendBaseUrl(req)
  );
  const frontendBaseUrl = trimTrailingSlash(process.env.FRONTEND_BASE_URL || "");

  const notificationUrl =
    process.env.KORA_WEBHOOK_URL ||
    (backendBaseUrl ? `${backendBaseUrl}/api/payments/webhook/kora` : undefined);

  const redirectUrl =
    process.env.KORA_REDIRECT_URL ||
    process.env.FRONTEND_PAYMENT_SUCCESS_URL ||
    (frontendBaseUrl ? `${frontendBaseUrl}/payment/success` : undefined);

  return { notificationUrl, redirectUrl };
};
