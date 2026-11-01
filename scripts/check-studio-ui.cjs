/* Runs each real Vela/browser fixture in isolation and stops on the first failure. */
const { spawnSync } = require("node:child_process");
for (const test of [
  "tests/native_shell_ui.cjs",
  "tests/project_wizard_ui.cjs",
  "tests/template_gallery_ui.cjs",
  "tests/web_studio_ui.cjs",
  "tests/web_studio_advanced_ui.cjs",
  "tests/web_monaco_ui.cjs",
  "tests/web_imported_blocks_ui.cjs",
  "tests/web_effects_ui.cjs",
  "tests/web_security_ui.cjs",
  "tests/web_templates_ui.cjs",
  "tests/premium_android_ui.cjs",
]) {
  const result = spawnSync(process.execPath, ["tests/run_ui.cjs", test], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
