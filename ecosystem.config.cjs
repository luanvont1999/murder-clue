/** PM2 trên VPS: pm2 start ecosystem.config.cjs */
module.exports = {
  apps: [
    {
      name: "murder-clue",
      script: "server/src/index.js",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      env: {
        NODE_ENV: "production",
        PORT: 4001,
        CLIENT_ORIGIN: "http://18.142.168.12",
        CORS_ORIGIN: "*",
      },
    },
  ],
};
