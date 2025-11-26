import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';

class ConfigStore {
  constructor(configDir = './.clawd') {
    this.configDir = configDir;
    this.configPath = join(configDir, 'config.json');
  }

  exists() {
    return existsSync(this.configPath);
  }

  load() {
    if (!this.exists()) {
      return null;
    }
    const content = readFileSync(this.configPath, 'utf-8');
    return JSON.parse(content);
  }

  save(config) {
    if (!existsSync(this.configDir)) {
      mkdirSync(this.configDir, { recursive: true });
    }
    const content = JSON.stringify(config, null, 2);
    writeFileSync(this.configPath, content + '\n');
  }

  getConfigPath() {
    return this.configPath;
  }

  getConfigDir() {
    return this.configDir;
  }
}

export { ConfigStore };
