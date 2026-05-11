import { BlobServiceClient, type ContainerClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import { mimeFromName, type ImageStorage } from './types.js';

// All uploaded exercise images live under this prefix inside the blob
// container, so the same storage account can hold unrelated data (other
// apps, future features) without colliding. The path mirrors the local
// folder layout (`public/exercise_images/<team>/<file>`) so downloads with
// `make pull-images` land in the right place automatically.
const BLOB_PREFIX = 'public/exercise_images/';

function blobKey(team: string, filename: string) {
  return `${BLOB_PREFIX}${team}/${filename}`;
}

export class BlobStorage implements ImageStorage {
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

  async save(team: string, filename: string, data: Buffer) {
    const blob = this.container.getBlockBlobClient(blobKey(team, filename));
    await blob.uploadData(data, {
      blobHTTPHeaders: { blobContentType: mimeFromName(filename) },
    });
    return { path: `/exercise_images/${team}/${filename}` };
  }

  async read(team: string, filename: string) {
    const blob = this.container.getBlockBlobClient(blobKey(team, filename));
    try {
      return await blob.downloadToBuffer();
    } catch (e: any) {
      if (e?.statusCode === 404) return null;
      throw e;
    }
  }
}
