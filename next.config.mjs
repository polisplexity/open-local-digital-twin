/** @type {import('next').NextConfig} */
const nextConfig = {
    sassOptions: {
        quietDeps: true, // Suppresses warnings from dependencies
        api: 'modern-compiler',

    },
};

export default nextConfig;
