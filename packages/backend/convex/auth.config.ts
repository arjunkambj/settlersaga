import { getConvexProvidersConfig } from "@hexclave/js/convex-auth.config";

export default {
  providers: getConvexProvidersConfig({
    projectId: process.env.HEXCLAVE_PROJECT_ID!,
  }),
};
