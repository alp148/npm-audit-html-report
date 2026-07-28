/**
 * @fileoverview File system helpers using fs/promises.
 */

import { promises as fs } from 'fs';
import path from 'path';

/**
 * Ensure a directory exists, creating it (and parents) if necessary.
 * @param dirPath - Absolute or relative directory path.
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Write a JSON-serializable value to a file.
 * @param filePath - Target file path.
 * @param data - Data to serialize.
 * @param pretty - Whether to pretty-print (default: true).
 */
export async function writeJson<T>(filePath: string, data: T, pretty = true): Promise<void> {
  const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Read and parse a JSON file.
 * @param filePath - Path to JSON file.
 */
export async function readJson<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

/**
 * Write a UTF-8 text file, creating parent directories as needed.
 * @param filePath - Target file path.
 * @param content - Text content to write.
 */
export async function writeFile(filePath: string, content: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Read a UTF-8 text file.
 * @param filePath - Path to read.
 */
export async function readFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf-8');
}

/**
 * Check whether a file or directory exists.
 * @param filePath - Path to check.
 */
export async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * List all files in a directory matching an optional extension filter.
 * @param dirPath - Directory to list.
 * @param ext - Optional extension filter (e.g. '.json').
 */
export async function listFiles(dirPath: string, ext?: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && (!ext || e.name.endsWith(ext)))
      .map((e) => path.join(dirPath, e.name));
  } catch {
    return [];
  }
}
