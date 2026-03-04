export function isAdminApiAuthorized(headers: Headers) {
  const key = headers.get("x-admin-key");
  return Boolean(process.env.ADMIN_API_KEY && key && key === process.env.ADMIN_API_KEY);
}

