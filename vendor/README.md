# SheetJS Community Edition

`xlsx-0.20.3.tgz` is the unmodified official SheetJS CE package (Apache-2.0).

- Source: https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
- SHA-256: `8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8`
- Package version and license were inspected before installation; npm records the archive's SHA-512 integrity in the lockfile. No independent upstream signature was available in the inspected release documentation.
- Official installation/vendoring guidance: https://docs.sheetjs.com/docs/getting-started/installation/nodejs/
- Fixed advisories: https://cdn.sheetjs.com/advisories/CVE-2023-30533 and https://cdn.sheetjs.com/advisories/CVE-2024-22363

The public npm registry stops at vulnerable 0.18.5. This local archive keeps clean installs independent of the SheetJS CDN and retains the `xlsx` module API. When updating it, use an explicit official version, inspect its metadata and advisories, record its new hash, regenerate the lockfile and run the workbook regressions. Do not replace it with an unofficial republished package.
