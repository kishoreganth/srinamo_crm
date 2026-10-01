import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGuestDto } from './dto/create-guest.dto';
import { UpdateGuestDto } from './dto/update-guest.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class GuestsService {
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

  async createGuest(dto: CreateGuestDto) {
    return this.prisma.guest.create({ data: dto });
  }

  async getGuests(pagination: PaginationDto) {
    const [data, total] = await Promise.all([
      this.prisma.guest.findMany({
        where: { deletedAt: null },
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.guest.count({ where: { deletedAt: null } }),
    ]);

    return {
      data,
      meta: {
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit),
      },
    };
  }

  async getGuestById(id: string) {
    const guest = await this.prisma.guest.findUnique({ where: { id } });
    if (!guest || guest.deletedAt) throw new NotFoundException('Guest not found');
    return guest;
  }

  async updateGuest(id: string, dto: UpdateGuestDto) {
    const guest = await this.prisma.guest.findUnique({ where: { id } });
    if (!guest || guest.deletedAt) throw new NotFoundException('Guest not found');
    return this.prisma.guest.update({ where: { id }, data: dto });
  }

  async searchGuests(query: string) {
    return this.prisma.guest.findMany({
      where: {
        deletedAt: null,
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query } },
          { email: { contains: query, mode: 'insensitive' } },
          { idNumber: { contains: query } },
        ],
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getGuestHistory(id: string) {
    const guest = await this.prisma.guest.findUnique({ where: { id } });
    if (!guest) throw new NotFoundException('Guest not found');

    return this.prisma.booking.findMany({
      where: { guestId: id },
      include: {
        room: { include: { roomType: { select: { name: true } } } },
        payments: true,
      },
      orderBy: { checkIn: 'desc' },
    });
  }

  async getGuestsBirthday(date: Date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();

    return this.prisma.$queryRawUnsafe<unknown[]>(
      `SELECT * FROM "Guest" WHERE EXTRACT(MONTH FROM "dateOfBirth") = $1 AND EXTRACT(DAY FROM "dateOfBirth") = $2 AND "deletedAt" IS NULL`,
      month,
      day,
    );
  }

  async uploadIdDocument(id: string, file: Express.Multer.File) {
    const guest = await this.prisma.guest.findUnique({ where: { id } });
    if (!guest) throw new NotFoundException('Guest not found');

    const key = `id-documents/${id}/${Date.now()}-${file.originalname}`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    const url = `${this.configService.get<string>('MINIO_ENDPOINT', 'http://localhost:9000')}/${this.bucketName}/${key}`;

    await this.prisma.guest.update({
      where: { id },
      data: { idDocumentUrl: url },
    });

    return { url };
  }
}
