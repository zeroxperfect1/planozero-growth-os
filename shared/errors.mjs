const TYPES = {
  string: "texto",
  number: "número",
  boolean: "sí o no",
  array: "lista",
  object: "objeto",
  null: "valor vacío",
  undefined: "valor vacío",
  nan: "número",
  date: "fecha",
};
const label = (issue) => (issue.path.length ? `${issue.path.join(".")}: ` : "");
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
export function zodMessage(issue) {
  const at = label(issue);
  switch (issue.code) {
    case "invalid_type":
      return `${at}Se esperaba ${TYPES[issue.expected] || issue.expected}${issue.received ? ` y se recibió ${TYPES[issue.received] || issue.received}` : ""}.`;
    case "too_small":
      if (issue.origin === "string")
        return `${at}Debe tener al menos ${plural(issue.minimum, "carácter", "caracteres")}.`;
      if (issue.origin === "array")
        return `${at}Debe incluir al menos ${plural(issue.minimum, "elemento", "elementos")}.`;
      return `${at}Debe ser mayor o igual a ${issue.minimum}.`;
    case "too_big":
      if (issue.origin === "string")
        return `${at}Debe tener como máximo ${plural(issue.maximum, "carácter", "caracteres")}.`;
      if (issue.origin === "array")
        return `${at}Debe incluir como máximo ${plural(issue.maximum, "elemento", "elementos")}.`;
      return `${at}Debe ser menor o igual a ${issue.maximum}.`;
    case "invalid_value":
      return `${at}Valor no válido. Opciones: ${(issue.values || []).join(" · ")}.`;
    case "invalid_format":
      return `${at}Formato no válido de ${issue.format === "email" ? "correo" : issue.format === "url" ? "enlace" : "texto"}.`;
    case "invalid_date":
      return `${at}Fecha inválida.`;
    case "invalid_union": {
      // zod v4 nests issues in `errors`, v3 in `unionErrors`.
      const nested = (issue.errors || issue.unionErrors || []).flatMap((error) => error.issues || error)[0];
      return nested
        ? zodMessage({ ...nested, path: [...issue.path, ...nested.path] })
        : `${at}Valor no válido.`;
    }
    default:
      return `${at}${issue.message}`;
  }
}
export const zodMessages = (error) =>
  (error.issues || []).map(zodMessage).join(" · ");
