/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    const isDev = process.env.NODE_ENV === "development";
    
    // 开发环境需要更宽松的 CSP（React Refresh 和 webpack 需要）
    const scriptSrc = isDev
      ? "'self' 'unsafe-inline' 'unsafe-eval'" // 开发环境允许内联脚本和 eval
      : "'self'"; // 生产环境严格限制
    
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              `style-src 'self' 'unsafe-inline'`, // 允许内联样式（用户 CSS 需要）
              `script-src ${scriptSrc}`,
              "font-src 'self'",
              "img-src 'self' data: https:",
              "connect-src 'self'" // 允许 fetch API
            ].join("; ")
          }
        ]
      }
    ];
  },
  webpack: (config, { isServer }) => {
    // 确保 PostCSS 和相关模块可以在客户端使用
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  }
};

export default nextConfig;

