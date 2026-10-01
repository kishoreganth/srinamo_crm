import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Decimal } from '@prisma/client/runtime/library';
import { PaymentStatus } from '@prisma/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateFolioItemDto } from './dto/create-folio-item.dto';

@Injectable()
export class BillingService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.s3Client = new S3Client({
      endpoint: this.configService.get<string>('MINIO_ENDPOINT', 'http://localhost:9000'),
      region: 'us-east-1',
      credentials: {
        accessKeyId: this.configService.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
        secretAccessKey: this.configService.get<string>('MINIO_SECRET_KEY', 'minioadmin'),
      },
      forcePathStyle: true,
    });
    this.bucketName = this.configService.get<string>('MINIO_BUCKET', 'srinamo-uploads');
  }

  async getFolio(bookingId: string) {
    const items = await this.prisma.folioItem.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'asc' },
    });

    const grouped: Record<string, typeof items> = {};
    for (const item of items) {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    }

    const total = items.reduce((sum, item) => sum.add(new Decimal(item.amount.toString()).mul(item.quantity)), new Decimal(0));

    return { items, grouped, total };
  }

  async addFolioItem(bookingId: string, dto: CreateFolioItemDto) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');

    return this.prisma.folioItem.create({
      data: {
        bookingId,
        description: dto.description,
        category: dto.category,
        amount: dto.amount,
        quantity: dto.quantity || 1,
      },
    });
  }

  async recordPayment(dto: CreatePaymentDto) {
    const booking = await this.prisma.booking.findUnique({ where: { id: dto.bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');

    const payment = await this.prisma.payment.create({
      data: {
        bookingId: dto.bookingId,
        amount: dto.amount,
        method: dto.method,
        status: PaymentStatus.COMPLETED,
        transactionId: dto.transactionId,
        paidAt: new Date(),
        notes: dto.notes,
      },
    });

    await this.updateGuestTotalSpent(booking.guestId, dto.amount);

    return payment;
  }

  async getPaymentSummary(bookingId: string) {
    const [folioItems, payments] = await Promise.all([
      this.prisma.folioItem.findMany({ where: { bookingId } }),
      this.prisma.payment.findMany({ where: { bookingId, status: PaymentStatus.COMPLETED } }),
    ]);

    const totalCharges = folioItems.reduce(
      (sum, item) => sum.add(new Decimal(item.amount.toString()).mul(item.quantity)),
      new Decimal(0),
    );

    const totalPaid = payments.reduce(
      (sum, p) => sum.add(new Decimal(p.amount.toString())),
      new Decimal(0),
    );

    const balance = totalCharges.sub(totalPaid);

    return { totalCharges, totalPaid, balance, payments };
  }

  async generateInvoice(bookingId: string, isGstInvoice: boolean, guestGstin?: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { guest: true, room: { include: { roomType: true } }, folioItems: true },
    });

    if (!booking) throw new NotFoundException('Booking not found');

    const subtotal = booking.folioItems.reduce(
      (sum, item) => sum.add(new Decimal(item.amount.toString()).mul(item.quantity)),
      new Decimal(0),
    );

    let cgstRate: number;
    let sgstRate: number;

    if (isGstInvoice) {
      const roomRate = Number(booking.room.roomType.basePrice);
      if (roomRate <= 7500) {
        cgstRate = 6;
        sgstRate = 6;
      } else {
        cgstRate = 9;
        sgstRate = 9;
      }
    } else {
      cgstRate = 0;
      sgstRate = 0;
    }

    const cgst = subtotal.mul(cgstRate).div(100);
    const sgst = subtotal.mul(sgstRate).div(100);
    const totalAmount = subtotal.add(cgst).add(sgst);

    const invoiceNumber = await this.generateInvoiceNumber();

    return this.prisma.invoice.create({
      data: {
        bookingId,
        invoiceNumber,
        subtotal,
        cgst,
        sgst,
        igst: 0,
        totalAmount,
        guestGstin: guestGstin || null,
        isGstInvoice,
      },
    });
  }

  async getPaymentsByBooking(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');

    return this.prisma.payment.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getInvoice(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        booking: {
          include: {
            guest: true,
            room: { include: { roomType: true } },
            folioItems: true,
          },
        },
      },
    });

    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async generateInvoicePdf(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        booking: {
          include: {
            guest: true,
            room: { include: { roomType: true } },
            folioItems: true,
          },
        },
      },
    });

    if (!invoice) throw new NotFoundException('Invoice not found');

    const pdfBuffer = await this.buildPdf(invoice);

    const key = `invoices/${invoice.invoiceNumber}.pdf`;
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
      }),
    );

    const pdfUrl = `${this.configService.get<string>('MINIO_ENDPOINT', 'http://localhost:9000')}/${this.bucketName}/${key}`;

    await this.prisma.invoice.update({ where: { id: invoiceId }, data: { pdfUrl } });

    return { pdfUrl };
  }

  private async buildPdf(invoice: {
    invoiceNumber: string;
    subtotal: Decimal;
    cgst: Decimal;
    sgst: Decimal;
    totalAmount: Decimal;
    isGstInvoice: boolean;
    guestGstin: string | null;
    booking: {
      bookingCode: string;
      checkIn: Date;
      checkOut: Date;
      guest: { firstName: string; lastName: string; phone: string; address: string | null };
      room: { roomNumber: string; roomType: { name: string } };
      folioItems: { description: string; category: string; amount: Decimal; quantity: number }[];
    };
  }): Promise<Buffer> {
    return new Promise((resolve) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      doc.fontSize(20).text('SriNamo Farms Resort', { align: 'center' });
      doc.fontSize(10).text('Tax Invoice', { align: 'center' });
      doc.moveDown();

      doc.fontSize(10);
      doc.text(`Invoice #: ${invoice.invoiceNumber}`);
      doc.text(`Booking: ${invoice.booking.bookingCode}`);
      doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`);
      doc.moveDown();

      doc.text(`Guest: ${invoice.booking.guest.firstName} ${invoice.booking.guest.lastName}`);
      doc.text(`Phone: ${invoice.booking.guest.phone}`);
      if (invoice.booking.guest.address) doc.text(`Address: ${invoice.booking.guest.address}`);
      if (invoice.guestGstin) doc.text(`GSTIN: ${invoice.guestGstin}`);
      doc.moveDown();

      doc.text(`Room: ${invoice.booking.room.roomNumber} (${invoice.booking.room.roomType.name})`);
      doc.text(`Check-in: ${invoice.booking.checkIn.toLocaleDateString('en-IN')}`);
      doc.text(`Check-out: ${invoice.booking.checkOut.toLocaleDateString('en-IN')}`);
      doc.moveDown();

      doc.fontSize(12).text('Charges:', { underline: true });
      doc.fontSize(10);
      for (const item of invoice.booking.folioItems) {
        const amount = new Decimal(item.amount.toString()).mul(item.quantity);
        doc.text(`  ${item.description} (x${item.quantity}) - Rs. ${amount.toFixed(2)}`);
      }
      doc.moveDown();

      doc.text(`Subtotal: Rs. ${invoice.subtotal.toFixed(2)}`);
      if (invoice.isGstInvoice) {
        doc.text(`CGST: Rs. ${invoice.cgst.toFixed(2)}`);
        doc.text(`SGST: Rs. ${invoice.sgst.toFixed(2)}`);
      }
      doc.fontSize(12).text(`Total: Rs. ${invoice.totalAmount.toFixed(2)}`, { bold: true } as PDFKit.Mixins.TextOptions);

      doc.end();
    });
  }

  private async generateInvoiceNumber(): Promise<string> {
    const today = new Date();
    const fy = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
    const prefix = `SNF-INV-${fy}${fy + 1 - 2000}`;

    const last = await this.prisma.invoice.findFirst({
      where: { invoiceNumber: { startsWith: prefix } },
      orderBy: { invoiceNumber: 'desc' },
    });

    let seq = 1;
    if (last) {
      const parts = last.invoiceNumber.split('-');
      seq = parseInt(parts[parts.length - 1], 10) + 1;
    }

    return `${prefix}-${String(seq).padStart(5, '0')}`;
  }

  private async updateGuestTotalSpent(guestId: string, amount: number) {
    await this.prisma.guest.update({
      where: { id: guestId },
      data: { totalSpent: { increment: amount } },
    });
  }
}
