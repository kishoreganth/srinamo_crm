import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateFolioItemDto } from './dto/create-folio-item.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('folio/:bookingId')
  @ApiOperation({ summary: 'Get folio items for a booking' })
  async getFolio(@Param('bookingId') bookingId: string) {
    return this.billingService.getFolio(bookingId);
  }

  @Post('folio/:bookingId/item')
  @ApiOperation({ summary: 'Add folio item' })
  async addFolioItem(@Param('bookingId') bookingId: string, @Body() dto: CreateFolioItemDto) {
    return this.billingService.addFolioItem(bookingId, dto);
  }

  @Get('payments/:bookingId')
  @ApiOperation({ summary: 'Get payments for a booking' })
  async getPayments(@Param('bookingId') bookingId: string) {
    return this.billingService.getPaymentsByBooking(bookingId);
  }

  @Post('payments')
  @ApiOperation({ summary: 'Record a payment' })
  async recordPayment(@Body() dto: CreatePaymentDto) {
    return this.billingService.recordPayment(dto);
  }

  @Get('summary/:bookingId')
  @ApiOperation({ summary: 'Get payment summary for a booking' })
  async paymentSummary(@Param('bookingId') bookingId: string) {
    return this.billingService.getPaymentSummary(bookingId);
  }

  @Post('invoices/:bookingId')
  @ApiOperation({ summary: 'Generate invoice' })
  async generateInvoice(@Param('bookingId') bookingId: string, @Body() dto: CreateInvoiceDto) {
    return this.billingService.generateInvoice(bookingId, dto.isGstInvoice, dto.guestGstin);
  }

  @Get('invoices/:id')
  @ApiOperation({ summary: 'Get invoice details' })
  async getInvoice(@Param('id') id: string) {
    return this.billingService.getInvoice(id);
  }

  @Get('invoices/:id/pdf')
  @ApiOperation({ summary: 'Get invoice PDF URL' })
  async getInvoicePdf(@Param('id') id: string) {
    return this.billingService.generateInvoicePdf(id);
  }
}
