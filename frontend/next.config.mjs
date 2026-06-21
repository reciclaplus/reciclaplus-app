/** @type {import("next").NextConfig} */
const nextConfig = {};

// Local dev workarounds (32-bit Node, stray lock files) — skip on Vercel.
if (!process.env.VERCEL) {
  nextConfig.outputFileTracingRoot = import.meta.dirname;
  nextConfig.webpack = (config) => {
    config.cache = false;
    return config;
  };
}

export default nextConfig;
