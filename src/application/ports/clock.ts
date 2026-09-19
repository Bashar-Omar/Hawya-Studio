import type { ISODateTime } from "@/domain/common/primitives";

export interface Clock {
  now(): ISODateTime;
}
