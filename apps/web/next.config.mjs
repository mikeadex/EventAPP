/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@ekklesia/shared'],
  typedRoutes: true,
  webpack: (config) => {
    // tsconfig `paths` point @ekklesia/shared at its TypeScript source, which
    // is written for the API's NodeNext build and so says `./slug.js` for a
    // file on disk called `slug.ts`. Let webpack try the .ts beside it, as
    // the mobile app's Metro config already does.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
    };
    return config;
  },
};
export default nextConfig;
