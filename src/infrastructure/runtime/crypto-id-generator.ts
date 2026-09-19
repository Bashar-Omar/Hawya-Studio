import type { IdGenerator } from "@/application/ports/id-generator";
import { type UUID, uuidSchema } from "@/domain/common/primitives";

export class CryptoIdGenerator implements IdGenerator {
  newId(): UUID {
    return uuidSchema.parse(crypto.randomUUID());
  }
}
