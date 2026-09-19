import { MigrationError } from "@/domain/project/errors";
import { type ProjectSnapshot, projectSnapshotSchema } from "@/domain/project/hawya-project";
import { CURRENT_PROJECT_SCHEMA_VERSION } from "@/domain/project/schema-version";

export interface ProjectMigration {
  readonly from: number;
  readonly to: number;
  migrate(input: unknown): unknown;
}

const migrations: readonly ProjectMigration[] = [];

function readSchemaVersion(input: unknown): number | undefined {
  if (typeof input !== "object" || input === null || !("project" in input)) {
    return undefined;
  }

  const project = Reflect.get(input, "project");
  if (typeof project !== "object" || project === null || !("schemaVersion" in project)) {
    return undefined;
  }

  const version = Reflect.get(project, "schemaVersion");
  return typeof version === "number" && Number.isInteger(version) ? version : undefined;
}

export function migrateProjectSnapshot(input: unknown): ProjectSnapshot {
  const sourceVersion = readSchemaVersion(input);
  if (sourceVersion === undefined) {
    throw new MigrationError(
      "Project schema version is missing or invalid",
      -1,
      CURRENT_PROJECT_SCHEMA_VERSION,
    );
  }
  if (sourceVersion > CURRENT_PROJECT_SCHEMA_VERSION) {
    throw new MigrationError(
      `Project schema version ${sourceVersion} is newer than this Hawya build supports`,
      sourceVersion,
      CURRENT_PROJECT_SCHEMA_VERSION,
    );
  }

  let current: unknown = structuredClone(input);
  let version = sourceVersion;

  while (version < CURRENT_PROJECT_SCHEMA_VERSION) {
    const migration = migrations.find((candidate) => candidate.from === version);
    if (!migration || migration.to !== version + 1) {
      throw new MigrationError(
        `No sequential migration is available from schema version ${version}`,
        sourceVersion,
        CURRENT_PROJECT_SCHEMA_VERSION,
      );
    }
    current = migration.migrate(current);
    version = migration.to;
  }

  const parsed = projectSnapshotSchema.safeParse(current);
  if (!parsed.success) {
    throw new MigrationError(
      `Migrated project failed schema ${CURRENT_PROJECT_SCHEMA_VERSION} validation`,
      sourceVersion,
      CURRENT_PROJECT_SCHEMA_VERSION,
    );
  }
  return parsed.data;
}
