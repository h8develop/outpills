import { Injectable, Logger } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

/**
 * Слой хранилища изображений товаров.
 *
 * Изображения НЕ хранятся в контейнере приложения — только object storage:
 *  - dev:  MinIO из docker-compose (S3-совместимый);
 *  - prod: любой S3-совместимый сервис (Selectel, VK Cloud, Yandex Object
 *          Storage, Timeweb S3, AWS S3) — меняется только env-конфиг.
 *
 * Загрузка идёт через presigned URL: админка кладёт файл напрямую
 * в хранилище, минуя backend, — backend не становится бутылочным горлышком
 * при загрузке медиа.
 *
 * Раздача: publicUrl() строит URL от STORAGE_PUBLIC_URL — в проде сюда
 * ставится CDN-домен, и все картинки автоматически уходят за CDN.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private client: S3Client | null = null;
  private readonly bucket = process.env.STORAGE_BUCKET || 'outpills-media';

  constructor() {
    if (process.env.STORAGE_TYPE === 's3') {
      this.client = new S3Client({
        endpoint: process.env.STORAGE_ENDPOINT,
        region: process.env.STORAGE_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.STORAGE_ACCESS_KEY || '',
          secretAccessKey: process.env.STORAGE_SECRET_KEY || '',
        },
        forcePathStyle: true, // нужно для MinIO
      });
    } else {
      this.logger.warn('STORAGE_TYPE != s3 — presigned upload отключён (dev-режим)');
    }
  }

  /** Presigned URL для прямой загрузки изображения из админки */
  async createUploadUrl(contentType: string, ext: string) {
    const objectKey = `products/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${ext}`;
    if (!this.client) {
      // dev-заглушка без S3: фиктивный URL, чтобы флоу админки был проходим
      return { objectKey, uploadUrl: null, note: 'S3 не сконфигурирован (STORAGE_TYPE != s3)' };
    }
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 600 });
    return { objectKey, uploadUrl };
  }

  /**
   * Публичный URL картинки. STORAGE_PUBLIC_URL:
   *  dev:  http://localhost:9000/outpills-media
   *  prod: https://cdn.outpills.com  (CDN поверх бакета)
   */
  publicUrl(objectKey: string): string {
    const base = process.env.STORAGE_PUBLIC_URL || 'http://localhost:9000/outpills-media';
    return `${base.replace(/\/$/, '')}/${objectKey}`;
  }
}
