import type { UUID } from "@/domain/common/primitives";

export interface IdGenerator {
  newId(): UUID;
}
