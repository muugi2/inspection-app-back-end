const fs = require('fs/promises');
const path = require('path');

const DEFAULT_STORAGE_PATH =
  process.env.FTP_STORAGE_PATH || path.resolve('C:/ftp_data');
const DEFAULT_PUBLIC_BASE_URL =
  process.env.FTP_PUBLIC_BASE_URL ||
  'http://192.168.0.6:4555/uploads';
const FTP_REMOTE_PREFIX = (process.env.FTP_REMOTE_PREFIX || 'test')
  .trim()
  .replace(/^\/+|\/+$/g, '');

function normalizeRelativePath(input) {
  if (!input) {
    return null;
  }

  let value = String(input).trim();
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    value = parsed.pathname || '';
  } catch (error) {
    // Ignore parse errors – input is not a URL
  }

  value = value.replace(/\\/g, '/');
  value = value.replace(/^\/+/, '');

  const segments = value
    .split('/')
    .map(segment => segment.trim())
    .filter(segment => segment && segment !== '.' && segment !== '..');

  if (segments.length === 0) {
    return null;
  }

  return segments.join('/');
}

function stripRemotePrefix(relativePath) {
  if (!relativePath) {
    return null;
  }

  if (!FTP_REMOTE_PREFIX) {
    return relativePath;
  }

  const prefixWithSlash = `${FTP_REMOTE_PREFIX}/`;
  if (relativePath === FTP_REMOTE_PREFIX) {
    return '';
  }

  if (relativePath.startsWith(prefixWithSlash)) {
    return relativePath.slice(prefixWithSlash.length);
  }

  return relativePath;
}

function resolveLocalPath(relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  if (!normalized) {
    return null;
  }

  const sanitized = stripRemotePrefix(normalized);
  if (!sanitized) {
    return null;
  }

  const base = path.resolve(DEFAULT_STORAGE_PATH);
  const absolutePath = path.resolve(base, sanitized);

  if (!absolutePath.startsWith(base)) {
    throw new Error(`Invalid path traversal attempt: ${relativePath}`);
  }

  return absolutePath;
}

async function readImageAsBase64(relativePath) {
  const localPath = resolveLocalPath(relativePath);
  if (!localPath) {
    return null;
  }

  try {
    const fileBuffer = await fs.readFile(localPath);
    return fileBuffer.toString('base64');
  } catch (error) {
    console.error(
      `[imageStorage] Failed to read file ${localPath}: ${error.message}`
    );
    return null;
  }
}

function buildPublicUrl(relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  if (!normalized) {
    return null;
  }

  const sanitized = stripRemotePrefix(normalized);
  if (!sanitized) {
    return null;
  }

  const base = DEFAULT_PUBLIC_BASE_URL.replace(/\/+$/, '');
  return `${base}/${sanitized}`;
}

async function loadImagePayload(relativePath) {
  const localPath = resolveLocalPath(relativePath);
  if (!localPath) {
    return { base64: null, size: null, localPath: null };
  }

  try {
    const fileBuffer = await fs.readFile(localPath);
    const stats = await fs.stat(localPath);
    return {
      base64: fileBuffer.toString('base64'),
      size: stats.size,
      localPath,
    };
  } catch (error) {
    console.error(
      `[imageStorage] Failed to load payload for ${localPath}: ${error.message}`
    );
    return { base64: null, size: null, localPath };
  }
}

function inferMimeType(relativePath) {
  const normalized = normalizeRelativePath(relativePath) || '';
  const lower = normalized.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.bmp')) return 'image/bmp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  return 'image/jpeg';
}

module.exports = {
  normalizeRelativePath,
  resolveLocalPath,
  readImageAsBase64,
  buildPublicUrl,
  loadImagePayload,
  inferMimeType,
  DEFAULT_STORAGE_PATH,
  DEFAULT_PUBLIC_BASE_URL,
  FTP_REMOTE_PREFIX,
};

