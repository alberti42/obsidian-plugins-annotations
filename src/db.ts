// db.ts

import { Vault } from 'obsidian';

const DB_FILE = 'plugin-annotations.json';

interface PluginAnnotation {
  [pluginId: string]: string;
}

export async function loadAnnotations(vault: Vault): Promise<PluginAnnotation> {
  try {
    const file = await vault.adapter.read(DB_FILE);
    return JSON.parse(file);
  } catch (error) {
    console.error('Failed to load annotations:', error);
    return {};
  }
}

export async function saveAnnotations(vault: Vault, annotations: PluginAnnotation): Promise<void> {
  try {
    const data = JSON.stringify(annotations, null, 2);
    await vault.adapter.write(DB_FILE, data);
  } catch (error) {
    console.error('Failed to save annotations:', error);
  }
}
