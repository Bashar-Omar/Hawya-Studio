import type { LogoGeometryInsight } from "@/domain/smart/logo-analysis";

export interface LogoAnalyzer {
  analyze(bytes: Uint8Array, mime: string): Promise<LogoGeometryInsight>;
}
