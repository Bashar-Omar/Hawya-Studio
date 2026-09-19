# Third-party notices — Stage 01 UI foundation

Hawya Studio remains MIT licensed. Stage 01 uses the following separately licensed dependencies:

- Base UI (`@base-ui/react`) — MIT.
- Lucide (`lucide-react`) — ISC.
- Inter Variable through Fontsource — SIL Open Font License 1.1.
- Noto Sans Arabic Variable through Fontsource — SIL Open Font License 1.1.

The package manager lockfile pins the exact package artifacts used by the build. Font binaries are not committed to this repository; Vite emits same-origin web-font assets from the installed Fontsource packages during the build.
