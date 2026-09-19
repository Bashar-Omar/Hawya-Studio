# Bundled UI Font Licenses

Hawya Studio self-hosts its interface fonts from version-locked Fontsource packages. This keeps the core UI independent from runtime font CDNs.

| UI font | Package | Version | License | Canonical license |
| --- | --- | ---: | --- | --- |
| Inter Variable | `@fontsource-variable/inter` | 5.3.0 | SIL Open Font License 1.1 | https://openfontlicense.org/open-font-license-official-text/ |
| Noto Sans Arabic Variable | `@fontsource-variable/noto-sans-arabic` | 5.3.0 | SIL Open Font License 1.1 | https://openfontlicense.org/open-font-license-official-text/ |

The installed package is the canonical redistribution unit during development and includes its license metadata. Production builds emit font binaries from those pinned packages. Keep this record beside the source, preserve the package license metadata in dependency/release audits, and do not replace these font files with unlicensed binaries.

Hawya user-project font licensing is a separate product concern defined by the typography/export specifications; these UI-font licenses do not grant rights to user-uploaded brand fonts.
