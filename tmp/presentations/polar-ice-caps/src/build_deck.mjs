import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const {
  Presentation,
  PresentationFile,
  row,
  column,
  grid,
  layers,
  panel,
  text,
  shape,
  rule,
  fill,
  hug,
  fixed,
  wrap,
  fr,
  auto,
} = await import("@oai/artifact-tool");

const WIDTH = 1920;
const HEIGHT = 1080;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_DIR = path.join(ROOT, "output");
const RENDER_DIR = path.join(ROOT, "scratch", "renders");
const PPTX_PATH = path.join(OUTPUT_DIR, "output.pptx");

const colors = {
  night: "#0B1E33",
  deep: "#123A5A",
  ocean: "#1F6FA8",
  ice: "#DDF4FF",
  mist: "#A5D8F3",
  white: "#F8FCFF",
  slate: "#D7E5EF",
  frost: "#6EC5E9",
  teal: "#4BAAB8",
};

const titleStyle = {
  fontFace: "Georgia",
  fontSize: 58,
  bold: true,
  color: colors.white,
};

const bodyStyle = {
  fontFace: "Trebuchet MS",
  fontSize: 26,
  color: colors.slate,
};

const smallStyle = {
  fontFace: "Trebuchet MS",
  fontSize: 20,
  color: colors.mist,
};

function bgShape(name, fillColor, width = fill, height = fill, borderRadius) {
  return shape({
    name,
    geometry: "rect",
    width,
    height,
    fill: fillColor,
    borderRadius,
  });
}

function chip(label) {
  return panel(
    {
      name: `chip-${label}`,
      width: hug,
      height: hug,
      padding: { x: 18, y: 10 },
      borderRadius: "rounded-full",
      fill: "#163A57",
    },
    text(label, {
      width: hug,
      height: hug,
      style: {
        fontFace: "Trebuchet MS",
        fontSize: 18,
        bold: true,
        color: colors.ice,
      },
    }),
  );
}

function metricBlock(title, value, accent, note) {
  return panel(
    {
      name: `metric-${title}`,
      width: fill,
      height: fill,
      padding: { x: 36, y: 30 },
      borderRadius: "rounded-xl",
      fill: "#F5FBFF",
    },
    column(
      { width: fill, height: fill, justify: "between" },
      [
        text(title, {
          width: fill,
          height: hug,
          style: {
            fontFace: "Trebuchet MS",
            fontSize: 22,
            bold: true,
            color: colors.deep,
          },
        }),
        text(value, {
          width: fill,
          height: hug,
          style: {
            fontFace: "Georgia",
            fontSize: 82,
            bold: true,
            color: accent,
          },
        }),
        text(note, {
          width: fill,
          height: hug,
          style: {
            fontFace: "Trebuchet MS",
            fontSize: 22,
            color: "#44667D",
          },
        }),
      ],
    ),
  );
}

function polarCard(title, sub1, sub2, accent, hemisphereLabel) {
  return panel(
    {
      name: `card-${title}`,
      width: fill,
      height: fill,
      padding: { x: 32, y: 28 },
      borderRadius: "rounded-xl",
      fill: "#F7FBFE",
    },
    column(
      { width: fill, height: fill, gap: 22 },
      [
        row(
          { width: fill, height: hug, justify: "between", align: "center" },
          [
            text(title, {
              width: hug,
              height: hug,
              style: {
                fontFace: "Georgia",
                fontSize: 42,
                bold: true,
                color: colors.deep,
              },
            }),
            chip(hemisphereLabel),
          ],
        ),
        layers(
          { width: fill, height: fixed(170), alignItems: "center", justifyItems: "center" },
          [
            bgShape(`disc-${title}`, accent, fixed(170), fixed(170), "rounded-full"),
            bgShape(`ring-${title}`, "#FFFFFFAA", fixed(118), fixed(118), "rounded-full"),
            rule({
              name: `axis-${title}`,
              width: fixed(300),
              stroke: "#7AB7D4",
              weight: 3,
            }),
          ],
        ),
        text(sub1, {
          width: fill,
          height: hug,
          style: {
            ...bodyStyle,
            color: "#21455F",
          },
        }),
        text(sub2, {
          width: fill,
          height: hug,
          style: {
            ...bodyStyle,
            color: "#4D6D82",
          },
        }),
      ],
    ),
  );
}

function sectionTitle(title, subtitle, dark = true) {
  return column(
    { width: fill, height: hug, gap: 12, columnSpan: 2 },
    [
      text(title, {
        name: "slide-title",
        width: fill,
        height: hug,
        style: {
          ...titleStyle,
          color: dark ? colors.white : colors.deep,
        },
      }),
      text(subtitle, {
        name: "slide-subtitle",
        width: wrap(1300),
        height: hug,
        style: {
          ...bodyStyle,
          fontSize: 24,
          color: dark ? colors.mist : "#4C6B82",
        },
      }),
    ],
  );
}

async function saveBinary(blob, filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  if (typeof blob.save === "function") {
    await blob.save(filePath);
    return;
  }
  const data = blob instanceof Uint8Array ? blob : new Uint8Array(await blob.arrayBuffer());
  await fs.writeFile(filePath, data);
}

function addCover(presentation) {
  const slide = presentation.slides.add();
  slide.compose(
    layers(
      { name: "cover-root", width: fill, height: fill, alignItems: "stretch", justifyItems: "stretch" },
      [
        bgShape("cover-bg", colors.night),
        shape({
          name: "cover-sweep-top",
          geometry: "rect",
          width: fixed(760),
          height: fixed(260),
          fill: "#1A4D72",
          borderRadius: "rounded-full",
        }),
        shape({
          name: "cover-sweep-bottom",
          geometry: "rect",
          width: fixed(980),
          height: fixed(300),
          fill: "#0F5B86",
          borderRadius: "rounded-full",
        }),
        grid(
          {
            name: "cover-grid",
            width: fill,
            height: fill,
            columns: [fr(1.1), fr(0.9)],
            rows: [auto, fr(1), auto],
            columnGap: 48,
            rowGap: 20,
            padding: { x: 90, y: 74 },
          },
          [
            row({ width: fill, height: hug, gap: 14, align: "center" }, [chip("Short presentation"), chip("4 slides")]),
            column(
              { width: fill, height: fill, gap: 20, justify: "center", rowSpan: 2 },
              [
                text("Polar Ice Caps", {
                  width: wrap(780),
                  height: hug,
                  style: {
                    fontFace: "Georgia",
                    fontSize: 86,
                    bold: true,
                    color: colors.white,
                  },
                }),
                text("What they are, where they are, and why they matter to our planet.", {
                  width: wrap(720),
                  height: hug,
                  style: {
                    fontFace: "Trebuchet MS",
                    fontSize: 30,
                    color: colors.ice,
                  },
                }),
              ],
            ),
            column(
              { width: fill, height: fill, justify: "center", align: "end", rowSpan: 2 },
              [
                text("66° North", {
                  width: fixed(320),
                  height: hug,
                  style: {
                    fontFace: "Georgia",
                    fontSize: 92,
                    bold: true,
                    color: colors.frost,
                  },
                }),
                text("66° South", {
                  width: fixed(320),
                  height: hug,
                  style: {
                    fontFace: "Georgia",
                    fontSize: 92,
                    bold: true,
                    color: colors.white,
                  },
                }),
                text("approximate limits of the polar regions", {
                  width: wrap(360),
                  height: hug,
                  style: {
                    ...smallStyle,
                    color: colors.ice,
                  },
                }),
              ],
            ),
            text("Arctic at the North Pole. Antarctica at the South Pole.", {
              width: fill,
              height: hug,
              style: smallStyle,
            }),
          ],
        ),
      ],
    ),
    { frame: { left: 0, top: 0, width: WIDTH, height: HEIGHT }, baseUnit: 8 },
  );
}

function addLocationSlide(presentation) {
  const slide = presentation.slides.add();
  slide.compose(
    layers(
      { width: fill, height: fill, alignItems: "stretch", justifyItems: "stretch" },
      [
        bgShape("location-bg", colors.ice),
        grid(
          {
            width: fill,
            height: fill,
            columns: [fr(1), fr(1)],
            rows: [auto, fr(1), auto],
            columnGap: 30,
            rowGap: 28,
            padding: { x: 84, y: 70 },
          },
          [
            sectionTitle("Where they are", "Polar ice caps occupy the ends of the Earth and lie beyond 66° latitude.", false),
            polarCard("Arctic", "A frozen ocean surrounded by northern countries.", "Canada, Russia, Greenland, the United States, and Norway.", "#A4DDF7", "North"),
            polarCard("Antarctica", "An ice-covered continent at the South Pole.", "It does not belong to one country and is governed by an international treaty.", "#57B5D9", "South"),
            text("Both store enormous amounts of ice and help regulate the global climate.", {
              width: wrap(1500),
              height: hug,
              columnSpan: 2,
              style: {
                fontFace: "Trebuchet MS",
                fontSize: 24,
                bold: true,
                color: colors.deep,
              },
            }),
          ],
        ),
      ],
    ),
    { frame: { left: 0, top: 0, width: WIDTH, height: HEIGHT }, baseUnit: 8 },
  );
}

function addClimateSlide(presentation) {
  const slide = presentation.slides.add();
  slide.compose(
    layers(
      { width: fill, height: fill, alignItems: "stretch", justifyItems: "stretch" },
      [
        bgShape("climate-bg", colors.deep),
        shape({
          name: "climate-band",
          geometry: "rect",
          width: fill,
          height: fixed(220),
          fill: "#0E5279",
        }),
        grid(
          {
            width: fill,
            height: fill,
            columns: [fr(1), fr(1)],
            rows: [auto, fr(1), auto],
            columnGap: 32,
            rowGap: 30,
            padding: { x: 86, y: 72 },
          },
          [
            sectionTitle("Extreme climate", "These are among the coldest places on Earth: freezing, dry, and very windy."),
            metricBlock("Arctic winter", "-34 °C", colors.ocean, "Average temperature"),
            metricBlock("Antarctic winter", "-60 °C", colors.teal, "Can fall even lower"),
            text("Snow, strong winds, and permanent ice.", {
              width: wrap(700),
              height: hug,
              columnSpan: 2,
              style: {
                fontFace: "Trebuchet MS",
                fontSize: 24,
                bold: true,
                color: colors.ice,
              },
            }),
          ],
        ),
      ],
    ),
    { frame: { left: 0, top: 0, width: WIDTH, height: HEIGHT }, baseUnit: 8 },
  );
}

function addLifeSlide(presentation) {
  const slide = presentation.slides.add();
  slide.compose(
    layers(
      { width: fill, height: fill, alignItems: "stretch", justifyItems: "stretch" },
      [
        bgShape("life-bg", "#F4FBFF"),
        grid(
          {
            width: fill,
            height: fill,
            columns: [fr(0.95), fr(1.05)],
            rows: [auto, fr(1)],
            columnGap: 42,
            rowGap: 28,
            padding: { x: 88, y: 72 },
          },
          [
            sectionTitle("Life and importance", "Even in these harsh conditions, life exists and the ice is vital for Earth's balance.", false),
            column(
              { width: fill, height: fill, gap: 18, justify: "center" },
              [
                panel(
                  { width: fill, height: hug, padding: { x: 24, y: 20 }, fill: "#DFF3FB", borderRadius: "rounded-xl" },
                  text("Simple vegetation: mosses, lichens, and very few flowers.", {
                    width: fill,
                    height: hug,
                    style: {
                      ...bodyStyle,
                      color: colors.deep,
                    },
                  }),
                ),
                panel(
                  { width: fill, height: hug, padding: { x: 24, y: 20 }, fill: "#CDEAF6", borderRadius: "rounded-xl" },
                  text("The Arctic supports more plant life than Antarctica.", {
                    width: fill,
                    height: hug,
                    style: {
                      ...bodyStyle,
                      color: colors.deep,
                    },
                  }),
                ),
                panel(
                  { width: fill, height: hug, padding: { x: 24, y: 20 }, fill: "#B8E0F0", borderRadius: "rounded-xl" },
                  text("Their ice helps reflect heat and regulate the global climate.", {
                    width: fill,
                    height: hug,
                    style: {
                      ...bodyStyle,
                      color: colors.deep,
                    },
                  }),
                ),
              ],
            ),
            layers(
              { width: fill, height: fill, alignItems: "stretch", justifyItems: "stretch" },
              [
                panel(
                  {
                    width: fill,
                    height: fill,
                    padding: { x: 42, y: 42 },
                    borderRadius: "rounded-2xl",
                    fill: colors.night,
                  },
                  column(
                    { width: fill, height: fill, justify: "between" },
                    [
                      text("Brutal beauty,", {
                        width: wrap(520),
                        height: hug,
                        style: {
                          fontFace: "Georgia",
                          fontSize: 64,
                          bold: true,
                          color: colors.white,
                        },
                      }),
                      text("global balance.", {
                        width: wrap(520),
                        height: hug,
                        style: {
                          fontFace: "Georgia",
                          fontSize: 64,
                          bold: true,
                          color: colors.frost,
                        },
                      }),
                      text("Conclusion: understanding and protecting these regions helps protect the future of our planet.", {
                        width: wrap(560),
                        height: hug,
                        style: {
                          fontFace: "Trebuchet MS",
                          fontSize: 26,
                          color: colors.ice,
                        },
                      }),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ],
    ),
    { frame: { left: 0, top: 0, width: WIDTH, height: HEIGHT }, baseUnit: 8 },
  );
}

async function renderPresentation(presentation, prefix) {
  const renders = [];
  const layouts = [];
  for (let index = 0; index < presentation.slides.count; index += 1) {
    const slide = presentation.slides.getItem(index);
    const png = await slide.export({ format: "png", scale: 1 });
    const pngPath = path.join(RENDER_DIR, `${prefix}-slide-${index + 1}.png`);
    await saveBinary(png, pngPath);
    renders.push(pngPath);

    const layout = await slide.export({ format: "layout" });
    const layoutPath = path.join(RENDER_DIR, `${prefix}-slide-${index + 1}.layout.json`);
    await fs.writeFile(layoutPath, `${JSON.stringify(layout, null, 2)}\n`, "utf8");
    layouts.push(layoutPath);
  }
  return { renders, layouts };
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.mkdir(RENDER_DIR, { recursive: true });

  const presentation = Presentation.create({
    slideSize: { width: WIDTH, height: HEIGHT },
  });

  addCover(presentation);
  addLocationSlide(presentation);
  addClimateSlide(presentation);
  addLifeSlide(presentation);

  const sourcePreview = await renderPresentation(presentation, "source");
  const pptxBlob = await PresentationFile.exportPptx(presentation);
  await saveBinary(pptxBlob, PPTX_PATH);

  const pptxBytes = await fs.readFile(PPTX_PATH);
  const loaded = await PresentationFile.importPptx(pptxBytes);
  const savedPreview = await renderPresentation(loaded, "saved");

  const manifest = {
    pptx: PPTX_PATH,
    sourcePreview,
    savedPreview,
  };

  await fs.writeFile(
    path.join(RENDER_DIR, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  console.log(JSON.stringify(manifest, null, 2));
}

await main();
