// Electrobun preBuild hook: a release without SETTERSAGA_WEB_URL would open localhost for every player.
if (process.env.ELECTROBUN_BUILD_ENV !== "dev" && !process.env.SETTERSAGA_WEB_URL) {
  console.error(
    "Set SETTERSAGA_WEB_URL to the deployed web app's URL for canary and stable builds.",
  );
  process.exit(1);
}
