import { canWrite } from "../shared/permissions.mjs";
import type { Collection, Entity, User } from "./types";
export function canEdit(
  user: User | null,
  collection: Collection,
  item?: Entity,
) {
  return canWrite(user, collection, item);
}
