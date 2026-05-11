import { BlobServiceClient, type ContainerClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import { mimeFromName, type FileStorage } from './types.js';

/**
 * Stores files as blobs whose name is the storage key. Keys are passed
 * through verbatim, so a key like `public/content/cykla.md` becomes a blob
 * named exactly that within the container — making `make pull-content`
 * (which downloads with `--destination .`) land the file at
 * `public/content/cykla.md` on disk automatically.
 */
export class BlobStorage implements FileStorage {
  readonly backend = 'blob' as const;
  private readonly container: ContainerClient;

  constructor(accountName: string, containerName: string) {
    const credential = new DefaultAzureCredential();
    const service = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      credential,
    );
    this.container = service.getContainerClient(containerName);
  }

  async save(key: string, data: Buffer, contentType?: string) {
    const blob = this.container.getBlockBlobClient(key);
    await blob.uploadData(data, {
      blobHTTPHeaders: {
        blobContentType: contentType ?? mimeFromName(key),
      },
    });
  }

  async read(key: string) {
    const blob = this.container.getBlockBlobClient(key);
    try {
      return await blob.downloadToBuffer();
    } catch (e: any) {
      if (e?.statusCode === 404) return null;
      throw e;
    }
  }

  async list(prefix: string) {
    const keys: string[] = [];
    for await (const blob of this.container.listBlobsFlat({ prefix })) {
      keys.push(blob.name);
    }
    return keys;
  }
}
