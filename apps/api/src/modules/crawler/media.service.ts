import { Injectable, Logger } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import * as sharp from 'sharp';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly thumbnailDir = path.join(process.cwd(), 'storage', 'thumbnails');

  constructor(private telegramService: TelegramService) {
    this.ensureDirectories();
  }

  private async ensureDirectories() {
    await fs.mkdir(this.thumbnailDir, { recursive: true });
  }

  async generateThumbnail(buffer: Buffer, fileId: string): Promise<string> {
    try {
      const thumbnailPath = path.join(this.thumbnailDir, `${fileId}.jpg`);

      await sharp(buffer)
        .resize(200, 200, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toFile(thumbnailPath);

      return `/thumbnails/${fileId}.jpg`;
    } catch (error) {
      this.logger.error(`Failed to generate thumbnail for ${fileId}`, error);
      throw error;
    }
  }

  async getThumbnailPath(fileId: string): Promise<string | null> {
    const thumbnailPath = path.join(this.thumbnailDir, `${fileId}.jpg`);
    try {
      await fs.access(thumbnailPath);
      return thumbnailPath;
    } catch {
      return null;
    }
  }

  async cleanupOldThumbnails(maxAgeHours = 24) {
    const now = Date.now();
    const maxAge = maxAgeHours * 60 * 60 * 1000;

    try {
      const files = await fs.readdir(this.thumbnailDir);

      for (const file of files) {
        const filePath = path.join(this.thumbnailDir, file);
        const stats = await fs.stat(filePath);

        if (now - stats.mtimeMs > maxAge) {
          await fs.unlink(filePath);
          this.logger.log(`Deleted old thumbnail: ${file}`);
        }
      }
    } catch (error) {
      this.logger.error('Failed to cleanup thumbnails', error);
    }
  }
}
