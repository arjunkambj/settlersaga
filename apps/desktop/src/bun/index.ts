import { BrowserWindow, BuildConfig, Updater } from "electrobun/bun";

const { runtime } = await BuildConfig.get();
const webUrl = runtime?.webUrl;
if (typeof webUrl !== "string") {
  throw new Error("build.json has no runtime.webUrl. Build the shell with the Electrobun CLI.");
}

// `pnpm dev:desktop` starts Next.js alongside the shell, and the window never retries a
// refused connection, so dev builds wait for the server to answer first.
if ((await Updater.localInfo.channel()) === "dev") {
  await waitForServer(webUrl);
}

new BrowserWindow({
  title: "SetterSaga",
  url: webUrl,
  frame: {
    width: 1280,
    height: 820,
    x: 120,
    y: 120,
  },
});

async function waitForServer(url: string): Promise<void> {
  console.log(`Waiting for the web app at ${url}`);
  for (;;) {
    try {
      await fetch(url, { method: "HEAD" });
      return;
    } catch {
      await Bun.sleep(500);
    }
  }
}
