module.exports = {
  apps: [
    {
      name: 'tikicottage-backend',
      script: './dist/server.js',
      cwd: '/var/www/tikicottage/backend',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: '/var/log/pm2/tikicottage-error.log',
      out_file: '/var/log/pm2/tikicottage-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
    },
  ],
};
