# Advisory range verification

October 22, 2026. All 63 official records matched baseline package versions; 1 remains in the patched lockfile. Package-version matches do not establish exploitability. SheetJS fix versions were verified separately against its maintainer advisories because the fixed releases are outside the npm registry.

| Advisory | CVE | Baseline matching range | Patched result |
| --- | --- | --- | --- |
| [GHSA-4x5r-pxfx-6jf8](https://github.com/babel/babel/security/advisories/GHSA-4x5r-pxfx-6jf8) | CVE-2026-49356 | @babel/core <= 7.29.0 | No patched-lock match |
| [GHSA-w5vr-8v7q-w6rv](https://github.com/advisories/GHSA-w5vr-8v7q-w6rv) | CVE-2026-45819 | baseline-browser-mapping >= 2.0.0, < 2.11.0 | No patched-lock match |
| [GHSA-jxxr-4gwj-5jf2](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-jxxr-4gwj-5jf2) | CVE-2026-45149 | brace-expansion >= 5.0.0, < 5.0.6 | No patched-lock match |
| [GHSA-3jxr-9vmj-r5cp](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-3jxr-9vmj-r5cp) | CVE-2026-13149 | brace-expansion >= 3.0.0, < 5.0.7; brace-expansion < 1.1.16 | No patched-lock match |
| [GHSA-mh99-v99m-4gvg](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-mh99-v99m-4gvg) | CVE-2026-14257 | brace-expansion >= 4.0.0, < 5.0.8; brace-expansion < 1.1.17 | No patched-lock match |
| [GHSA-rgw5-rvv9-x895](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-rgw5-rvv9-x895) | CVE-2026-69152 | brace-expansion < 1.1.18; brace-expansion >= 4.0.0, < 5.0.9 | No patched-lock match |
| [GHSA-q2hr-2g5m-vwhr](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-q2hr-2g5m-vwhr) | CVE-2026-102277 | brace-expansion >= 4.0.0, < 5.0.12; brace-expansion < 1.1.21 | No patched-lock match |
| [GHSA-qhr7-859c-m2p7](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-qhr7-859c-m2p7) | CVE-2026-102278 | brace-expansion >= 4.0.0, < 5.0.11; brace-expansion < 1.1.20 | No patched-lock match |
| [GHSA-6j4f-fj2g-mc7p](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-6j4f-fj2g-mc7p) | CVE-2026-102276 | brace-expansion >= 4.0.0, < 5.0.10; brace-expansion < 1.1.19 | No patched-lock match |
| [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | CVE-2026-93687 | braces <= 3.0.3 | REMAINS: dev-only braces |
| [GHSA-c83g-rgw3-j3cx](https://github.com/browserslist/browserslist/security/advisories/GHSA-c83g-rgw3-j3cx) | CVE-2026-73089 | browserslist <= 4.28.6 | No patched-lock match |
| [GHSA-73wf-gq98-2v4g](https://github.com/browserslist/browserslist/security/advisories/GHSA-73wf-gq98-2v4g) | CVE-2026-73088 | browserslist <= 4.28.6 | No patched-lock match |
| [GHSA-h67p-54hq-rp68](https://github.com/nodeca/js-yaml/security/advisories/GHSA-h67p-54hq-rp68) | CVE-2026-53550 | js-yaml >= 4.0.0, <= 4.1.1 | No patched-lock match |
| [GHSA-52cp-r559-cp3m](https://github.com/nodeca/js-yaml/security/advisories/GHSA-52cp-r559-cp3m) | CVE-2026-59869 | js-yaml >= 4.0.0, < 4.3.0 | No patched-lock match |
| [GHSA-5p4m-2wfm-xmqj](https://github.com/nodeca/js-yaml/security/advisories/GHSA-5p4m-2wfm-xmqj) | Not assigned | js-yaml >= 4.0.0, < 4.3.1 | No patched-lock match |
| [GHSA-2883-xcg3-v3hh](https://github.com/nodeca/js-yaml/security/advisories/GHSA-2883-xcg3-v3hh) | CVE-2026-84375 | js-yaml >= 4.0.0, < 4.3.2 | No patched-lock match |
| [GHSA-28wg-ghj8-5hjv](https://github.com/advisories/GHSA-28wg-ghj8-5hjv) | CVE-2026-67214 | nanoid < 3.3.16 | No patched-lock match |
| [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8) | CVE-2026-67213 | nanoid < 3.3.18 | No patched-lock match |
| [GHSA-8h8q-6873-q5fj](https://github.com/facebook/react/security/advisories/GHSA-rv78-f8rc-xrxh) | Not assigned | next >= 16.0.0, < 16.2.5 | No patched-lock match |
| [GHSA-26hh-7cqf-hhc6](https://github.com/vercel/next.js/security/advisories/GHSA-267c-6grr-h53f) | CVE-2026-45109 | next >= 16.0.0, < 16.2.6 | No patched-lock match |
| [GHSA-3g8h-86w9-wvmq](https://github.com/vercel/next.js/security/advisories/GHSA-3g8h-86w9-wvmq) | CVE-2026-44572 | next >= 16.0.0, < 16.2.5 | No patched-lock match |
| [GHSA-ffhc-5mcf-pf4q](https://github.com/vercel/next.js/security/advisories/GHSA-ffhc-5mcf-pf4q) | CVE-2026-44581 | next >= 16.0.0, < 16.2.5 | No patched-lock match |
| [GHSA-vfv6-92ff-j949](https://github.com/vercel/next.js/security/advisories/GHSA-vfv6-92ff-j949) | CVE-2026-44582 | next >= 16.0.0, < 16.2.5 | No patched-lock match |
| [GHSA-gx5p-jg67-6x7h](https://github.com/vercel/next.js/security/advisories/GHSA-gx5p-jg67-6x7h) | CVE-2026-44580 | next >= 16.0.0, < 16.2.5 | No patched-lock match |
| [GHSA-mg66-mrh9-m8jx](https://github.com/vercel/next.js/security/advisories/GHSA-mg66-mrh9-m8jx) | CVE-2026-44579 | next >= 16.0.0, < 16.2.5 | No patched-lock match |
| [GHSA-h64f-5h5j-jqjh](https://github.com/vercel/next.js/security/advisories/GHSA-h64f-5h5j-jqjh) | CVE-2026-44577 | next >= 16.0.0, < 16.2.5 | No patched-lock match |
| [GHSA-c4j6-fc7j-m34r](https://github.com/vercel/next.js/security/advisories/GHSA-c4j6-fc7j-m34r) | CVE-2026-44578 | next >= 16.0.0, < 16.2.5 | No patched-lock match |
| [GHSA-492v-c6pp-mqqv](https://github.com/vercel/next.js/security/advisories/GHSA-492v-c6pp-mqqv) | CVE-2026-44574 | next >= 16.0.0, < 16.2.5 | No patched-lock match |
| [GHSA-wfc6-r584-vfw7](https://github.com/vercel/next.js/security/advisories/GHSA-wfc6-r584-vfw7) | CVE-2026-44576 | next >= 16.0.0, < 16.2.5 | No patched-lock match |
| [GHSA-267c-6grr-h53f](https://github.com/vercel/next.js/security/advisories/GHSA-267c-6grr-h53f) | CVE-2026-44575 | next >= 16.0.0, < 16.2.5 | No patched-lock match |
| [GHSA-36qx-fr4f-26g5](https://github.com/vercel/next.js/security/advisories/GHSA-36qx-fr4f-26g5) | CVE-2026-44573 | next >= 16.0.0, < 16.2.5 | No patched-lock match |
| [GHSA-6gpp-xcg3-4w24](https://github.com/vercel/next.js/security/advisories/GHSA-6gpp-xcg3-4w24) | CVE-2026-64642 | next >= 16.0.0, < 16.2.11 | No patched-lock match |
| [GHSA-m99w-x7hq-7vfj](https://github.com/vercel/next.js/security/advisories/GHSA-m99w-x7hq-7vfj) | CVE-2026-64641 | next >= 16.0.0, < 16.2.11 | No patched-lock match |
| [GHSA-89xv-2m56-2m9x](https://github.com/vercel/next.js/security/advisories/GHSA-89xv-2m56-2m9x) | CVE-2026-64649 | next >= 16.0.0, < 16.2.11 | No patched-lock match |
| [GHSA-68g3-v927-f742](https://github.com/vercel/next.js/security/advisories/GHSA-68g3-v927-f742) | CVE-2026-64648 | next >= 16.0.0, < 16.2.11 | No patched-lock match |
| [GHSA-4633-3j49-mh5q](https://github.com/vercel/next.js/security/advisories/GHSA-4633-3j49-mh5q) | CVE-2026-64647 | next >= 16.0.0, < 16.2.11 | No patched-lock match |
| [GHSA-4c39-4ccg-62r3](https://github.com/vercel/next.js/security/advisories/GHSA-4c39-4ccg-62r3) | CVE-2026-64646 | next >= 16.0.0, < 16.2.11 | No patched-lock match |
| [GHSA-p9j2-gv94-2wf4](https://github.com/vercel/next.js/security/advisories/GHSA-p9j2-gv94-2wf4) | CVE-2026-64645 | next >= 16.0.0, < 16.2.11 | No patched-lock match |
| [GHSA-q8wf-6r8g-63ch](https://github.com/vercel/next.js/security/advisories/GHSA-q8wf-6r8g-63ch) | CVE-2026-64644 | next >= 16.0.0, < 16.2.11 | No patched-lock match |
| [GHSA-955p-x3mx-jcvp](https://github.com/vercel/next.js/security/advisories/GHSA-955p-x3mx-jcvp) | CVE-2026-64643 | next >= 16.0.0, < 16.2.11 | No patched-lock match |
| [GHSA-p293-qw3h-jr36](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36) | CVE-2026-75604 | next >= 16.0.0, < 16.3.3 | No patched-lock match |
| [GHSA-2xp9-vwfh-vxw4](https://github.com/strukturag/libheif/security/advisories/GHSA-g89c-p67h-r497) | Not assigned | next >= 16.0.0, < 16.3.3 | No patched-lock match |
| [GHSA-vcvr-r3jv-pc5j](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j) | Not assigned | next >= 16.2.0, < 16.3.6 | No patched-lock match |
| [GHSA-4jqv-mc3x-m676](https://github.com/vercel/next.js/security/advisories/GHSA-4jqv-mc3x-m676) | CVE-2026-94543 | next >= 16.0.0, < 16.3.8 | No patched-lock match |
| [GHSA-39w2-rjm5-chcv](https://github.com/vercel/next.js/security/advisories/GHSA-39w2-rjm5-chcv) | CVE-2026-94486 | next >= 16.0.0, < 16.3.8 | No patched-lock match |
| [GHSA-f87g-xv8r-7p7x](https://github.com/vercel/next.js/security/advisories/GHSA-f87g-xv8r-7p7x) | CVE-2026-94485 | next >= 16.0.0, < 16.3.8 | No patched-lock match |
| [GHSA-mcj8-r9mp-w47p](https://github.com/vercel/next.js/security/advisories/GHSA-mcj8-r9mp-w47p) | CVE-2026-94484 | next >= 16.0.0, < 16.3.8 | No patched-lock match |
| [GHSA-cjq9-62q9-8jv4](https://github.com/vercel/next.js/security/advisories/GHSA-cjq9-62q9-8jv4) | CVE-2026-94483 | next >= 16.0.0, < 16.3.8 | No patched-lock match |
| [GHSA-2464-fhr4-w9xw](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw) | Not assigned | next >= 16.0.0, <= 16.4.0 | No patched-lock match |
| [GHSA-p3m5-59mp-jv5r](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r) | CVE-2026-94482 | next >= 16.0.0, <= 16.4.0 | No patched-lock match |
| [GHSA-673q-mjm6-r5xr](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr) | Not assigned | next >= 16.0.0, <= 16.4.0 | No patched-lock match |
| [GHSA-qx2v-qp2m-jg93](https://github.com/postcss/postcss/security/advisories/GHSA-qx2v-qp2m-jg93) | CVE-2026-41305 | postcss < 8.5.10 | No patched-lock match |
| [GHSA-6g55-p6wh-862q](https://github.com/postcss/postcss/security/advisories/GHSA-6g55-p6wh-862q) | CVE-2026-45623 | postcss <= 8.5.11 | No patched-lock match |
| [GHSA-fxqj-rqcc-2cmp](https://github.com/postcss/postcss/security/advisories/GHSA-fxqj-rqcc-2cmp) | CVE-2026-69153 | postcss <= 8.5.22 | No patched-lock match |
| [GHSA-r28c-9q8g-f849](https://github.com/postcss/postcss/security/advisories/GHSA-r28c-9q8g-f849) | CVE-2026-73646 | postcss <= 8.5.17 | No patched-lock match |
| [GHSA-f88m-g3jw-g9cj](https://github.com/libvips/libvips/security/advisories/GHSA-2fcj-gj27-279x) | Not assigned | sharp < 0.35.0 | No patched-lock match |
| [GHSA-rgj7-g3m4-5g8c](https://github.com/lovell/sharp/security/advisories/GHSA-rgj7-g3m4-5g8c) | Not assigned | sharp < 0.35.4 | No patched-lock match |
| [GHSA-wq5f-xc86-pv6w](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w) | Not assigned | sharp < 0.35.5 | No patched-lock match |
| [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) | CVE-2026-93749 | source-map-js >= 1.0.0, < 1.2.2 | No patched-lock match |
| [GHSA-58qx-3vcg-4xpx](https://github.com/websockets/ws/security/advisories/GHSA-58qx-3vcg-4xpx) | CVE-2026-45736 | ws >= 8.0.0, < 8.20.1 | No patched-lock match |
| [GHSA-96hv-2xvq-fx4p](https://github.com/websockets/ws/security/advisories/GHSA-96hv-2xvq-fx4p) | CVE-2026-48779 | ws >= 8.0.0, < 8.21.0 | No patched-lock match |
| [GHSA-4r6h-8v6p-xvw6](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6) | CVE-2023-30533 | xlsx < 0.19.3 | No patched-lock match |
| [GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9) | CVE-2024-22363 | xlsx < 0.20.2 | No patched-lock match |
