// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'spiderforce4ai',
    script: 'src/index.js',
    instances: 1,
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '2G',
    env: {
      NODE_ENV: 'development',
      PORT: 3004
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3004
    },
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
    log_file: 'logs/combined.log',
    time: true,
    max_restarts: 10,
    restart_delay: 4000,
    kill_timeout: 3000,
    node_args: '--max-old-space-size=512'
  }]
};