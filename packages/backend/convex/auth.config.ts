import { getConvexProvidersConfig } from "@hexclave/js/convex-auth.config";

export default {
  providers: getConvexProvidersConfig({
    // oxlint-disable-next-line @convex-dev/no-process-env -- the typed env needs this declared in convex.config.ts and a codegen run against the deployment
    projectId: process.env.HEXCLAVE_PROJECT_ID!,
  }),
};
