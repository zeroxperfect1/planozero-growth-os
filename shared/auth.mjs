export const COMPANY_DOMAIN = "planozero.cl";
export const normalizeEmail = (email) => String(email ?? "").trim().toLowerCase();
export const isCompanyEmail = (email) => {
  const normalized = normalizeEmail(email);
  const at = normalized.lastIndexOf("@");
  return at > 0 && normalized.slice(at + 1) === COMPANY_DOMAIN;
};
