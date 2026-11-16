const fs = require("node:fs");
const path = require("node:path");
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
let text =
  "# Third-party notices\n\nGenerated from installed production dependencies. Electron and Chromium notices are also shipped beside the executable.\n\n";
for (const [location, entry] of Object.entries(lock.packages)) {
  if (
    !location ||
    entry.dev ||
    !fs.existsSync(path.join(location, "package.json"))
  )
    continue;
  const pkg = JSON.parse(
    fs.readFileSync(path.join(location, "package.json"), "utf8"),
  );
  text += `## ${pkg.name} ${pkg.version}\n\nLicense: ${typeof pkg.license === "string" ? pkg.license : JSON.stringify(pkg.license)}\n\nSource: ${typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url || pkg.homepage || "See package registry"}\n\n`;
  for (const file of fs
    .readdirSync(location)
    .filter((f) => /^(license|licence|copying|notice)(\.|$|-)/i.test(f))) {
    const full = path.join(location, file);
    if (fs.statSync(full).isFile())
      text += `### ${file}\n\n${fs.readFileSync(full, "utf8")}\n\n`;
  }
  if (pkg.name.startsWith("@img/sharp-")) {
    const versions = path.join(location, "versions.json");
    if (fs.existsSync(versions))
      text +=
        "Bundled native component versions:\n\n" +
        fs.readFileSync(versions, "utf8") +
        "\n\n";
    const readme = path.join(location, "README.md");
    if (fs.existsSync(readme)) text += fs.readFileSync(readme, "utf8") + "\n\n";
  }
}
text +=
  "## Native libvips redistribution\n\nSharp uses dynamically linked libvips, licensed under LGPL-3.0-or-later. The DLLs remain unpacked in resources/app.asar.unpacked/node_modules/@img/sharp-win32-x64/lib and can be replaced with compatible builds. No restriction is imposed on reverse engineering for debugging modifications to these libraries. Corresponding upstream sources and build recipes: https://github.com/libvips/libvips and https://github.com/lovell/sharp-libvips. Consult versions.json for the exact bundled library versions. This development build is unsigned. Review redistribution obligations before publishing a release.\n";
for (const file of fs.readdirSync("vendor-licenses"))
  text +=
    `\n## ${file}\n\n` +
    fs.readFileSync(path.join("vendor-licenses", file), "utf8") +
    "\n";
fs.writeFileSync("THIRD_PARTY_NOTICES.md", text);
