import type { Clock } from "@/application/ports/clock";
import { type ISODateTime, isoDateTimeSchema } from "@/domain/common/primitives";

export class SystemClock implements Clock {
  now(): ISODateTime {
    return isoDateTimeSchema.parse(new Date().toISOString());
  }
}
