import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly webhookBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.webhookBaseUrl = this.configService.get<string>('N8N_WEBHOOK_URL', 'http://localhost:5678');
  }

  triggerWebhook(event: string, data: unknown): void {
    const url = `${this.webhookBaseUrl}/webhook/${event}`;

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, data, timestamp: new Date().toISOString() }),
    }).catch((error) => {
      this.logger.warn(`Webhook failed for event "${event}": ${error.message}`);
    });
  }

  async testWebhook() {
    const url = `${this.webhookBaseUrl}/webhook/test`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'test',
        data: { message: 'Test webhook from SriNamo Farms PMS' },
        timestamp: new Date().toISOString(),
      }),
    });

    return {
      success: response.ok,
      status: response.status,
      url,
    };
  }
}
