import type { NextConfig } from "next";

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
};

export default nextConfig;
