import type { BinaryPayload } from "@/application/ports/binary-store";
import type { ProjectArchiveError } from "@/domain/project/errors";
import type { ProjectSnapshot } from "@/domain/project/hawya-project";
import type { Result } from "@/shared/types/result";

export interface ProjectArchiveBundle {
  snapshot: ProjectSnapshot;
  binaries: BinaryPayload[];
}

export interface ProjectArchiveCodec {
  encode(bundle: ProjectArchiveBundle): Promise<Result<Uint8Array, ProjectArchiveError>>;
  decode(bytes: Uint8Array): Promise<Result<ProjectArchiveBundle, ProjectArchiveError>>;
}
