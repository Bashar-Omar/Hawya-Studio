export interface StorageDiagnostics {
  persisted: boolean | undefined;
  usage: number | undefined;
  quota: number | undefined;
  supported: boolean;
}

export interface StorageManagerPort {
  diagnostics(): Promise<StorageDiagnostics>;
  requestPersistence(): Promise<boolean | undefined>;
}
