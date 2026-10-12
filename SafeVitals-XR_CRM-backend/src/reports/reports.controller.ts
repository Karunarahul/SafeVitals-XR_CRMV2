import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { ReportsService } from './reports.service';
import { CreateReportDto, AddReportCommentDto, ReviewReportDto } from './dto/report.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUserPayload } from '../common/interfaces/current-user.interface';

const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.csv',
  '.txt',
]);

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @ApiOperation({ summary: 'List weekly reports with filters' })
  findAll(@Query() query: any) {
    return this.reportsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get report details with attachments and comments' })
  findById(@Param('id') id: string) {
    return this.reportsService.findById(id);
  }

  @Post()
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      storage: diskStorage({
        destination: uploadDir,
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          cb(null, `${randomName}${extname(file.originalname).toLowerCase()}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
          return cb(
            new BadRequestException(
              `Invalid file '${file.originalname}'. Only PDF, Word, Excel, CSV, and image files are permitted.`,
            ),
            false,
          );
        }
        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max per file
    }),
  )
  @ApiOperation({ summary: 'Submit weekly report with optional file attachments' })
  create(
    @CurrentUser('userId') authorId: string,
    @Body() dto: CreateReportDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.reportsService.create(authorId, dto, files);
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Add a review comment to a report' })
  addComment(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: AddReportCommentDto,
  ) {
    return this.reportsService.addComment(id, userId, dto);
  }

  @Patch(':id/review')
  @Roles('Super Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Review weekly report (Approve or Needs Revision)' })
  reviewPatch(
    @Param('id') id: string,
    @CurrentUser('userId') reviewerId: string,
    @Body() dto: ReviewReportDto,
  ) {
    return this.reportsService.review(id, reviewerId, dto);
  }

  @Post(':id/review')
  @Roles('Super Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark report as reviewed' })
  review(
    @Param('id') id: string,
    @CurrentUser('userId') reviewerId: string,
    @Body() dto?: ReviewReportDto,
  ) {
    return this.reportsService.review(id, reviewerId, dto);
  }

  @Delete(':id')
  @Roles('Super Admin', 'Manager', 'Employee')
  @ApiOperation({ summary: 'Delete report (Author or Super Admin only)' })
  delete(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.reportsService.delete(id, currentUser);
  }
}
