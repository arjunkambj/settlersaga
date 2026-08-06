import hexclaveComponent from "@hexclave/next/convex.config";
import { defineApp, type ComponentDefinition } from "convex/server";

const app = defineApp();

app.use(hexclaveComponent as unknown as ComponentDefinition);

export default app;
