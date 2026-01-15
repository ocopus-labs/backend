import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

export interface UploadResult {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
}

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private isConfigured = false;

  constructor(private configService: ConfigService) {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      });
      this.isConfigured = true;
      this.logger.log('Cloudinary configured successfully');
    } else {
      this.logger.warn('Cloudinary not configured - missing environment variables');
    }
  }

  async uploadImage(
    imageData: string,
    folder: string = 'business-logos',
  ): Promise<UploadResult> {
    if (!this.isConfigured) {
      throw new Error('Cloudinary is not configured');
    }

    try {
      const result: UploadApiResponse = await cloudinary.uploader.upload(imageData, {
        folder,
        resource_type: 'image',
        transformation: [
          { width: 500, height: 500, crop: 'limit' },
          { quality: 'auto' },
          { fetch_format: 'auto' },
        ],
      });

      return {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
      };
    } catch (error) {
      this.logger.error('Error uploading to Cloudinary:', error);
      throw new Error('Failed to upload image');
    }
  }

  async deleteImage(publicId: string): Promise<void> {
    if (!this.isConfigured) {
      this.logger.warn('Cloudinary not configured - skipping delete');
      return;
    }

    try {
      await cloudinary.uploader.destroy(publicId);
      this.logger.log(`Deleted image: ${publicId}`);
    } catch (error) {
      this.logger.error('Error deleting from Cloudinary:', error);
    }
  }
}
