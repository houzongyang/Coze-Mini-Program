import { Controller, Post, Get, Delete, Param, UseInterceptors, UploadedFile, HttpCode, Body, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as fs from 'fs';
import { DocumentsService } from './documents.service';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { user_id?: string }
  ) {
    console.log('上传文件:', file?.originalname, file?.size, file?.mimetype);

    if (!file) {
      return { code: 400, msg: '未收到文件', data: null };
    }

    const result = await this.documentsService.uploadFile(file, body.user_id || 'demo-user');

    return { code: 200, msg: '上传成功', data: result };
  }

  /** 预览 / 下载文档文件 */
  @Post(':id/recalculate-page-count')
  @HttpCode(200)
  async recalculatePageCount(@Param('id') id: string) {
    const document = await this.documentsService.recalculateDocumentPageCount(id);
    if (!document) {
      return { code: 404, msg: '文档不存在', data: null };
    }

    return { code: 200, msg: '页数已重新识别', data: document };
  }

  @Get(':id/preview')
  async previewDocument(@Param('id') id: string, @Res() res: Response) {
    const info = await this.documentsService.getFilePath(id);

    if (!info) {
      return res.status(404).json({ code: 404, msg: '文档不存在' });
    }

    if (!info.filePath || !fs.existsSync(info.filePath)) {
      return res.status(410).json({ code: 410, msg: '文件已被移除或未持久化' });
    }

    res.setHeader('Content-Type', info.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(info.fileName)}"`
    );
    res.setHeader('Cache-Control', 'private, max-age=3600');

    const stream = fs.createReadStream(info.filePath);
    stream.on('error', () => res.status(500).end());
    stream.pipe(res);
  }

  @Get(':id/preview-pdf')
  async previewPdfDocument(@Param('id') id: string, @Res() res: Response) {
    const info = await this.documentsService.getPdfPreviewFilePath(id);

    if (!info) {
      return res.status(404).json({ code: 404, msg: '文档不存在' });
    }

    if (!info.filePath || !fs.existsSync(info.filePath)) {
      return res.status(410).json({ code: 410, msg: 'PDF 预览文件不可用' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(info.fileName)}"`,
    );
    res.setHeader('Cache-Control', 'private, max-age=3600');

    const stream = fs.createReadStream(info.filePath);
    stream.on('error', () => res.status(500).end());
    stream.pipe(res);
  }

  @Get('user/:userId')
  async getUserDocuments(@Param('userId') userId: string) {
    const docs = await this.documentsService.getDocumentsByUserId(userId);
    return { code: 200, msg: 'success', data: docs };
  }

  @Get(':id')
  async getDocument(@Param('id') id: string) {
    const doc = await this.documentsService.getDocumentById(id);

    if (!doc) {
      return { code: 404, msg: '文档不存在', data: null };
    }

    return { code: 200, msg: 'success', data: doc };
  }

  @Delete(':id')
  @HttpCode(200)
  async deleteDocument(@Param('id') id: string) {
    await this.documentsService.deleteDocument(id);
    return { code: 200, msg: '删除成功', data: null };
  }
}
