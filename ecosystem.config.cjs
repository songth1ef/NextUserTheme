module.exports = {
  apps: [
    {
      name: "nextusertheme",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 20201",
      cwd: "D:/code/github/NextUserTheme",
      env: {
        NODE_ENV: "production",
        PORT: "3100",
      },
    },
  ],
};
