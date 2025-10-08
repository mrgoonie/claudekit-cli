import pc from 'picocolors';

export const logger = {
  info: (message: string) => {
    console.log(pc.blue('ℹ'), message);
  },

  success: (message: string) => {
    console.log(pc.green('✔'), message);
  },

  warning: (message: string) => {
    console.log(pc.yellow('⚠'), message);
  },

  error: (message: string) => {
    console.error(pc.red('✖'), message);
  },

  debug: (message: string) => {
    if (process.env.DEBUG) {
      console.log(pc.gray('[DEBUG]'), message);
    }
  },

  // Sanitize sensitive data from logs
  sanitize: (text: string): string => {
    // Remove GitHub tokens
    return text
      .replace(/ghp_[a-zA-Z0-9]{36}/g, 'ghp_***')
      .replace(/github_pat_[a-zA-Z0-9_]{82}/g, 'github_pat_***')
      .replace(/gho_[a-zA-Z0-9]{36}/g, 'gho_***')
      .replace(/ghu_[a-zA-Z0-9]{36}/g, 'ghu_***')
      .replace(/ghs_[a-zA-Z0-9]{36}/g, 'ghs_***')
      .replace(/ghr_[a-zA-Z0-9]{36}/g, 'ghr_***');
  },
};
