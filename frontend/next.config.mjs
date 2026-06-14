/** @type {import("next").NextConfig} */
const nextConfig = {
  // Pin tracing root: a stray package-lock.json in the home dir otherwise
  // confuses Next.js root inference.
  outputFileTracingRoot: import.meta.dirname,
};

export default nextConfig;
