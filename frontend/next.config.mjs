/** @type {import("next").NextConfig} */
const nextConfig = {
  // Pin tracing root: a stray package-lock.json in the home dir otherwise
  // confuses Next.js root inference.
  outputFileTracingRoot: import.meta.dirname,
  // The dev machine runs 32-bit Node; webpack's filesystem cache tries to
  // allocate buffers larger than the 32-bit address space can provide
  // ("Array buffer allocation failed"). Disable the disk cache to stay within
  // the memory ceiling. (Remove once on 64-bit Node + Turbopack.)
  webpack: (config) => {
    config.cache = false;
    return config;
  },
};

export default nextConfig;
