import type { NextConfig } from "next";
import { config as dotenvConfig } from "dotenv";
import path from "path";

// Load environment variables from monorepo root .env (single source of truth)
dotenvConfig({ path: path.resolve(__dirname, "../../.env") });

const nextConfig: NextConfig = {
  webpack: (config, { webpack, isServer }) => {
    // Strip node: prefix from imports (e.g. node:buffer -> buffer)
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /^node:/,
        (resource: any) => {
          resource.request = resource.request.replace(/^node:/, "");
        }
      )
    );

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        buffer: "buffer",
        events: "events",
      };
      config.plugins.push(
        new webpack.ProvidePlugin({
          Buffer: ["buffer", "Buffer"],
        })
      );
    }
    return config;
  },
  turbopack: {},
};

export default nextConfig;
