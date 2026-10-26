const QUOTES = ["quotes"];
export function canWrite(user, collection, existing) {
  if (!user) return false;
  if (user.role === "Dirección") return true;
  if (["offers", "profiles"].includes(collection)) return false;
  if (QUOTES.includes(collection))
    return (
      user.role === "Comercial" && (!existing || existing.ownerId === user.id)
    );
  if (user.role === "Comercial")
    return [
      "prospects",
      "tasks",
      "partners",
      "content",
      "projects",
      "initiatives",
    ].includes(collection);
  if (user.role === "Estrategia / Diseño")
    return ["tasks", "content", "projects", "initiatives"].includes(collection);
  return (
    ["tasks", "content", "initiatives"].includes(collection) &&
    existing?.owner === user.name
  );
}
export function keepsOwner(user, existing, body) {
  return user?.role !== "Colaborador externo" || body?.owner === user.name;
}
