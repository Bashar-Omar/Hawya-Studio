# SOLID / Clean Architecture Application

SOLID is applied pragmatically, not as a reason to generate 400 interfaces.

## Single Responsibility
`ColorService` must not also save projects or show toasts. `ProjectArchiveCodec` encodes archives; storage adapter stores bytes.

## Open/Closed
Export formats implement `ExportRenderer`; new renderer does not change all existing ones. Binary storage can gain OPFS adapter through `BinaryStore`.

## Liskov
Adapters obey contracts including failure semantics. An OPFS adapter cannot silently become non-transactional where repository expects atomicity.

## Interface Segregation
Prefer `AssetReader`, `AssetWriter` where callers need only one direction rather than one giant `StorageService`.

## Dependency Inversion
Application use cases depend on ports. Dexie/browser APIs implement those ports in infrastructure.

## Domain rules should survive framework replacement
A unit test should be able to construct BrandSystem, run commands, compute audits and serialize data without React/JSDOM.

## Avoid architecture theater
Do not create classes for immutable data that plain typed objects handle better. Do not create repository interfaces around pure local arrays. Boundaries exist around actual side effects and volatility.
