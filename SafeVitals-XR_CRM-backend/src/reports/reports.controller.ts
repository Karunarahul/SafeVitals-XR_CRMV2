import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { ReportsService } from './reports.service';
import { CreateReportDto, AddReportCommentDto } from './dto/report.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';

const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

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
    FilesInterceptor('files', 10, {
      storage: diskStorage({
        destination: uploadDir,
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max per file
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

  @Post(':id/review')
  @Roles('Super Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark report as reviewed' })
  review(@Param('id') id: string) {
    return this.reportsService.review(id);
  }

  @Delete(':id')
  @Roles('Super Admin')
  @ApiOperation({ summary: 'Delete report' })
  delete(@Param('id') id: string) {
    return this.reportsService.delete(id);
  }
}
