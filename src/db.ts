// db.ts

import { Vault } from 'obsidian';

const DB_FILE = 'plugin-annotations.json';

interface PluginAnnotation {
  [pluginId: string]: string;
}

function isNodeJsError(error: any): error is NodeJS.ErrnoException {
  return error && typeof error.code === 'string';
}

async function getDbFilePath(vault: Vault): Promise<string> {
  const pluginFolder = vault.configDir;
  return `${pluginFolder}/${DB_FILE}`;
}

export async function loadAnnotations(vault: Vault): Promise<PluginAnnotation> {
  const filePath = await getDbFilePath(vault);
  
  try {
    const file = await vault.adapter.read(filePath);
    return JSON.parse(file);
  } catch (error) {
    if (isNodeJsError(error) && error.code === 'ENOENT') {
      // File does not exist, return an empty object
      console.log('Annotations file not found, loading empty annotations.');
      return {};
    } else {
      console.error('Failed to load annotations:', error);
      return {};
    }
  }
}

export async function saveAnnotations(vault: Vault, annotations: PluginAnnotation): Promise<void> {
  const filePath = await getDbFilePath(vault);

  try {
    const data = JSON.stringify(annotations, null, 2);
    await vault.adapter.write(filePath, data);
  } catch (error) {
    console.error('Failed to save annotations:', error);
  }
}
