import { BlobServiceClient, type ContainerClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import { mimeFromName, type ImageStorage } from './types.js';

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
    const blobName = `${team}/${filename}`;
    const blob = this.container.getBlockBlobClient(blobName);
    await blob.uploadData(data, {
      blobHTTPHeaders: { blobContentType: mimeFromName(filename) },
    });
    return { path: `/exercise_images/${team}/${filename}` };
  }

  async read(team: string, filename: string) {
    const blob = this.container.getBlockBlobClient(`${team}/${filename}`);
    try {
      return await blob.downloadToBuffer();
    } catch (e: any) {
      if (e?.statusCode === 404) return null;
      throw e;
    }
  }
}
