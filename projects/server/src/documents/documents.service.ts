import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { db } from '@/storage/database/sqlite-client';
import { documents } from '@/storage/database/shared/sqlite-schema';
import { eq } from 'drizzle-orm';
import { execFile } from 'child_process';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { promisify } from 'util';

// 上传文件的本地存储目录（相对于 server 进程 cwd，即 projects/projects/server）
const UPLOAD_DIR = path.resolve(process.cwd(), 'data', 'uploads');
const PDF_PREVIEW_DIR = path.join(UPLOAD_DIR, '_derived');
const OFFICE_FILE_EXTENSIONS = new Set(['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']);
const LIBREOFFICE_TIMEOUT_MS = 90_000;
const PYTHON_PAGE_COUNT_TIMEOUT_MS = 30_000;
const execFileAsync = promisify(execFile);
const PYTHON_PDF_PAGE_COUNT_SCRIPT = [
  'from pypdf import PdfReader',
  'import sys',
  'reader = PdfReader(sys.argv[1])',
  'print(len(reader.pages))',
].join('\n');

type OfficePageCountFailure =
  | 'empty_file'
  | 'converter_unavailable'
  | 'conversion_failed'
  | 'page_counter_unavailable'
  | 'converted_pdf_unreadable'
  | 'stored_file_missing'
  | 'unsupported_file_type';

class OfficePageCountException extends UnprocessableEntityException {
  constructor(reason: OfficePageCountFailure, extension: string) {
    const messages: Record<OfficePageCountFailure, string> = {
      empty_file: 'Office 文档为空，无法识别页数',
      converter_unavailable: '服务器未安装或未配置 LibreOffice，无法识别 Office 文档页数',
      conversion_failed: 'Office 文档转换失败，无法识别实际页数',
      page_counter_unavailable: '服务器未安装或未配置 pypdf，无法读取转换后的 PDF 页数',
      converted_pdf_unreadable: 'Office 文档转换后的 PDF 无法识别页数',
      stored_file_missing: '已上传文档文件不存在，无法重新识别页数',
      unsupported_file_type: '该文件类型不支持重新识别页数',
    };

    super({
      code: 422,
      msg: messages[reason],
      data: {
        page_count_error: {
          reason,
          file_extension: extension,
        },
      },
    });
  }
}

type StoredDocument = typeof documents.$inferSelect;

@Injectable()
export class DocumentsService {
  private readonly refreshedOfficeDocumentIds = new Set<string>();
  private readonly previewConversions = new Map<string, Promise<number>>();
  private conversionTail: Promise<void> = Promise.resolve();

  constructor() {
    // 确保上传目录存在
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
  }

  private parseFileType(_mimetype: string, filename: string): string {
    const ext = this.getFileExtension(filename);
    if (ext === 'pdf') return 'pdf';
    if (ext === 'docx' || ext === 'doc') return 'docx';
    if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
    if (ext === 'pptx' || ext === 'ppt') return 'pptx';
    if (ext === 'jpg' || ext === 'jpeg') return 'image';
    if (ext === 'png') return 'image';
    return 'other';
  }

  private getFileExtension(filename: string): string {
    return path.extname(filename).slice(1).toLowerCase();
  }

  private getPdfPreviewPath(docId: string): string {
    const cacheKey = createHash('sha256').update(docId).digest('hex');
    return path.join(PDF_PREVIEW_DIR, `${cacheKey}.pdf`);
  }

  private hasRegularFile(filePath: string): boolean {
    try {
      return fs.statSync(filePath).isFile();
    } catch (_) {
      return false;
    }
  }

  private getManagedFilePath(filePath: string | null): string | null {
    if (!filePath) {
      return null;
    }

    try {
      const uploadRoot = fs.realpathSync(UPLOAD_DIR);
      const resolvedPath = path.resolve(filePath);
      const realPath = fs.realpathSync(resolvedPath);
      const relativePath = path.relative(uploadRoot, realPath);
      if (
        !relativePath
        || relativePath.startsWith('..')
        || path.isAbsolute(relativePath)
        || !this.hasRegularFile(realPath)
      ) {
        return null;
      }
      return realPath;
    } catch (_) {
      return null;
    }
  }

  private async runQueuedConversion<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.conversionTail;
    let release!: () => void;
    this.conversionTail = new Promise<void>(resolve => {
      release = resolve;
    });

    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  private persistPdfPreview(sourcePdfPath: string, docId: string, extension: string): void {
    const previewPath = this.getPdfPreviewPath(docId);
    const stagingPath = path.join(
      PDF_PREVIEW_DIR,
      `.${path.basename(previewPath)}.${process.pid}.${Date.now()}.tmp`,
    );

    try {
      fs.mkdirSync(PDF_PREVIEW_DIR, { recursive: true });
      fs.copyFileSync(sourcePdfPath, stagingPath);
      if (!this.hasRegularFile(stagingPath)) {
        throw new Error('PDF preview staging file is missing');
      }
      fs.rmSync(previewPath, { force: true });
      fs.renameSync(stagingPath, previewPath);
    } catch (error) {
      fs.rmSync(stagingPath, { force: true });
      console.error('[DocumentsService] Failed to persist PDF preview:', error);
      throw new OfficePageCountException('conversion_failed', extension);
    }
  }

  /**
   * 从 PDF buffer 解析真实页数。
   * 原理：匹配 /Type /Page 对象数（排除 /Pages 父节点），
   *       回退到 /Count 字段，最终兜底返回 1。
   * 支持范围：标准 PDF 1.x/2.0；加密 PDF 无法解析时返回 1（前端可手动修改）。
   */
  private tryParsePdfPageCount(buffer: Buffer): number | null {
    try {
      // latin1 保留原始字节，避免 utf-8 解码破坏二进制内容
      const content = buffer.toString('latin1');
      // /Type /Page 后跟非 's' 字符，排除 /Type /Pages 父节点
      const pageMatches = content.match(/\/Type\s*\/Page[^s]/g);
      if (pageMatches && pageMatches.length > 0) {
        return pageMatches.length;
      }
      // 部分 PDF 用 /Count N 记录总页数，取最后一个（根节点）
      const countMatches = [...content.matchAll(/\/Count\s+(\d+)/g)];
      if (countMatches.length > 0) {
        const last = countMatches[countMatches.length - 1];
        const n = parseInt(last[1], 10);
        if (n > 0) return n;
      }
    } catch (e) {
      console.error('[DocumentsService] PDF page parse error:', e);
    }
    return null;
  }

  private parsePdfPageCount(buffer: Buffer): number {
    // Preserve the existing PDF fallback: callers may still adjust an unreadable PDF manually.
    return this.tryParsePdfPageCount(buffer) ?? 1;
  }

  private getLibreOfficeCandidates(): string[] {
    const configuredPaths = [
      process.env.LIBREOFFICE_PATH,
      process.env.SOFFICE_PATH,
    ]
      .filter((value): value is string => Boolean(value?.trim()))
      .map(value => value.trim());

    const candidates = [...configuredPaths];

    if (process.platform === 'win32') {
      const programFiles = [
        process.env.ProgramW6432,
        process.env.ProgramFiles,
        process.env['ProgramFiles(x86)'],
      ].filter((value): value is string => Boolean(value));

      for (const directory of programFiles) {
        candidates.push(path.join(directory, 'LibreOffice', 'program', 'soffice.exe'));
      }
      candidates.push('C:\\Program Files\\LibreOffice\\program\\soffice.exe');
    }

    candidates.push('soffice', 'libreoffice');
    return [...new Set(candidates)];
  }

  private isCommandUnavailable(error: unknown): boolean {
    return typeof error === 'object'
      && error !== null
      && 'code' in error
      && (error as NodeJS.ErrnoException).code === 'ENOENT';
  }

  private getPythonCandidates(): Array<{ executable: string; args: string[] }> {
    const configuredPaths = [process.env.PYTHON_PATH]
      .filter((value): value is string => Boolean(value?.trim()))
      .map(value => value.trim());
    const candidates: Array<{ executable: string; args: string[] }> = configuredPaths
      .map(executable => ({ executable, args: [] }));

    candidates.push({ executable: 'python', args: [] });
    if (process.platform === 'win32') {
      candidates.push({ executable: 'py', args: ['-3'] });
    } else {
      candidates.push({ executable: 'python3', args: [] });
    }

    const uniqueCandidates = new Map<string, { executable: string; args: string[] }>();
    for (const candidate of candidates) {
      uniqueCandidates.set(`${candidate.executable}\u0000${candidate.args.join('\u0000')}`, candidate);
    }
    return [...uniqueCandidates.values()];
  }

  private isPypdfUnavailable(error: unknown): boolean {
    if (this.isCommandUnavailable(error)) {
      return true;
    }

    if (typeof error !== 'object' || error === null) {
      return false;
    }

    const commandError = error as NodeJS.ErrnoException & { stderr?: string | Buffer };
    const details = [commandError.message, commandError.stderr?.toString()]
      .filter(Boolean)
      .join('\n');
    return /No module named ['\"]pypdf['\"]|ModuleNotFoundError.*pypdf/i.test(details);
  }

  private async countPdfPagesWithPypdf(pdfPath: string, extension: string): Promise<number> {
    for (const candidate of this.getPythonCandidates()) {
      try {
        const { stdout } = await execFileAsync(
          candidate.executable,
          [
            ...candidate.args,
            '-c',
            PYTHON_PDF_PAGE_COUNT_SCRIPT,
            pdfPath,
          ],
          {
            timeout: PYTHON_PAGE_COUNT_TIMEOUT_MS,
            windowsHide: true,
            maxBuffer: 1024 * 1024,
          },
        );
        const pageCount = Number.parseInt(stdout.trim(), 10);
        if (Number.isSafeInteger(pageCount) && pageCount > 0) {
          return pageCount;
        }

        console.error('[DocumentsService] pypdf returned an invalid page count:', stdout);
        throw new OfficePageCountException('converted_pdf_unreadable', extension);
      } catch (error) {
        if (error instanceof OfficePageCountException) {
          throw error;
        }
        if (this.isPypdfUnavailable(error)) {
          continue;
        }

        console.error('[DocumentsService] pypdf page count failed:', error);
        throw new OfficePageCountException('converted_pdf_unreadable', extension);
      }
    }

    throw new OfficePageCountException('page_counter_unavailable', extension);
  }

  private async convertOfficeToPdf(
    buffer: Buffer,
    extension: string,
    docId?: string,
  ): Promise<number> {
    if (buffer.length === 0) {
      throw new OfficePageCountException('empty_file', extension);
    }

    const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaomiao-page-count-'));
    const inputPath = path.join(tempDirectory, `source.${extension}`);
    const outputDirectory = path.join(tempDirectory, 'output');
    const profileDirectory = path.join(tempDirectory, 'profile');

    try {
      fs.writeFileSync(inputPath, buffer);
      fs.mkdirSync(outputDirectory);
      fs.mkdirSync(profileDirectory);

      const args = [
        `-env:UserInstallation=${pathToFileURL(profileDirectory).href}`,
        '--headless',
        '--nologo',
        '--nodefault',
        '--nofirststartwizard',
        '--nolockcheck',
        '--convert-to',
        'pdf',
        '--outdir',
        outputDirectory,
        inputPath,
      ];

      let commandWasAvailable = false;
      for (const executable of this.getLibreOfficeCandidates()) {
        try {
          await execFileAsync(executable, args, {
            timeout: LIBREOFFICE_TIMEOUT_MS,
            windowsHide: true,
            maxBuffer: 1024 * 1024,
          });
          commandWasAvailable = true;
          break;
        } catch (error) {
          if (this.isCommandUnavailable(error)) {
            continue;
          }

          console.error('[DocumentsService] LibreOffice conversion failed:', error);
          throw new OfficePageCountException('conversion_failed', extension);
        }
      }

      if (!commandWasAvailable) {
        throw new OfficePageCountException('converter_unavailable', extension);
      }

      const convertedPdfPath = path.join(outputDirectory, 'source.pdf');
      if (!this.hasRegularFile(convertedPdfPath)) {
        throw new OfficePageCountException('conversion_failed', extension);
      }

      const pageCount = await this.countPdfPagesWithPypdf(convertedPdfPath, extension);
      if (docId) {
        this.persistPdfPreview(convertedPdfPath, docId, extension);
      }
      return pageCount;
    } finally {
      try {
        fs.rmSync(tempDirectory, { recursive: true, force: true });
      } catch (error) {
        console.warn('[DocumentsService] Failed to remove page-count temp files:', error);
      }
    }
  }

  private async detectOfficePageCount(buffer: Buffer, extension: string): Promise<number> {
    return this.convertOfficeToPdf(buffer, extension);
  }

  private async ensureOfficePdfPreview(
    docId: string,
    buffer: Buffer,
    extension: string,
  ): Promise<number> {
    const previewPath = this.getPdfPreviewPath(docId);
    if (this.hasRegularFile(previewPath)) {
      return this.countPdfPagesWithPypdf(previewPath, extension);
    }

    const pending = this.previewConversions.get(docId);
    if (pending) {
      return pending;
    }

    const conversion = this.runQueuedConversion(async () => {
      if (this.hasRegularFile(previewPath)) {
        return this.countPdfPagesWithPypdf(previewPath, extension);
      }
      return this.convertOfficeToPdf(buffer, extension, docId);
    });
    this.previewConversions.set(docId, conversion);

    try {
      return await conversion;
    } finally {
      if (this.previewConversions.get(docId) === conversion) {
        this.previewConversions.delete(docId);
      }
    }
  }

  private async detectPageCount(file: Express.Multer.File, fileType: string): Promise<number> {
    if (fileType === 'pdf' && file.buffer?.length > 0) {
      return this.parsePdfPageCount(file.buffer);
    }

    const extension = this.getFileExtension(file.originalname);
    if (OFFICE_FILE_EXTENSIONS.has(extension)) {
      return this.detectOfficePageCount(file.buffer ?? Buffer.alloc(0), extension);
    }

    // Images, plain text, and other non-Office files retain the existing single-page behavior.
    return 1;
  }

  private toDocumentResponse(doc: StoredDocument) {
    const isOfficeDocument = OFFICE_FILE_EXTENSIONS.has(this.getFileExtension(doc.fileName));
    const hasPdfPreview = isOfficeDocument && this.hasRegularFile(this.getPdfPreviewPath(doc.id));
    return {
      id: doc.id,
      file_key: doc.fileKey,
      file_name: doc.fileName,
      file_type: doc.fileType,
      file_size: doc.fileSize,
      page_count: doc.pageCount,
      file_url: `/api/documents/${doc.id}/preview`,
      url: `/api/documents/${doc.id}/preview`,
      preview_pdf_url: hasPdfPreview ? `/api/documents/${doc.id}/preview-pdf` : null,
      preview_status: isOfficeDocument ? (hasPdfPreview ? 'ready' : 'not_generated') : 'not_applicable',
      file_path: doc.filePath,
      user_id: doc.userId,
      created_at: doc.createdAt,
    };
  }

  private async recalculateStoredOfficePageCount(doc: StoredDocument): Promise<StoredDocument> {
    const extension = this.getFileExtension(doc.fileName);
    if (!OFFICE_FILE_EXTENSIONS.has(extension)) {
      throw new OfficePageCountException('unsupported_file_type', extension || 'unknown');
    }

    const filePath = this.getManagedFilePath(doc.filePath);
    if (!filePath) {
      throw new OfficePageCountException('stored_file_missing', extension);
    }

    let sourceBuffer: Buffer;
    try {
      sourceBuffer = fs.readFileSync(filePath);
    } catch (_) {
      throw new OfficePageCountException('stored_file_missing', extension);
    }

    const pageCount = await this.ensureOfficePdfPreview(doc.id, sourceBuffer, extension);
    if (pageCount !== doc.pageCount) {
      await db.update(documents)
        .set({ pageCount })
        .where(eq(documents.id, doc.id));
      return { ...doc, pageCount };
    }

    return doc;
  }

  private async refreshStoredOfficePageCount(doc: StoredDocument): Promise<StoredDocument> {
    const extension = this.getFileExtension(doc.fileName);
    if (!OFFICE_FILE_EXTENSIONS.has(extension) || this.refreshedOfficeDocumentIds.has(doc.id)) {
      return doc;
    }

    try {
      const refreshedDocument = await this.recalculateStoredOfficePageCount(doc);
      this.refreshedOfficeDocumentIds.add(doc.id);
      return refreshedDocument;
    } catch (error) {
      // Keep an existing document list readable even if a legacy file is damaged or an optional
      // server dependency is unavailable. The explicit recalculation endpoint returns the error.
      console.warn('[DocumentsService] Unable to refresh legacy Office page count:', error);
      this.refreshedOfficeDocumentIds.add(doc.id);
      return doc;
    }
  }

  async recalculateDocumentPageCount(docId: string) {
    const result = await db.select().from(documents).where(eq(documents.id, docId));
    const doc = result[0];
    if (!doc) {
      return null;
    }

    const recalculatedDocument = await this.recalculateStoredOfficePageCount(doc);
    this.refreshedOfficeDocumentIds.add(docId);
    return this.toDocumentResponse(recalculatedDocument);
  }

  async uploadFile(file: Express.Multer.File, userId: string) {
    const fileType = this.parseFileType(file.mimetype, file.originalname);
    const docId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const extension = this.getFileExtension(file.originalname);
    const isOfficeDocument = OFFICE_FILE_EXTENSIONS.has(extension);
    // Office uploads create the same PDF used for exact page counting.
    const pageCount = isOfficeDocument
      ? await this.ensureOfficePdfPreview(docId, file.buffer ?? Buffer.alloc(0), extension)
      : await this.detectPageCount(file, fileType);
    // 保留原始扩展名，避免文件名冲突
    const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storedFilename = `${docId}_${safeOriginal}`;
    const filePath = path.join(UPLOAD_DIR, storedFilename);

    const fileKey = `documents/${storedFilename}`;
    let originalWasWritten = false;

    try {
      // 将内存中的 Buffer 写到磁盘
      fs.writeFileSync(filePath, file.buffer);
      originalWasWritten = true;

      await db.insert(documents).values({
        id: docId,
        userId: userId || 'demo-user',
        fileKey: fileKey,
        fileName: file.originalname,
        fileType: fileType,
        fileSize: file.size,
        pageCount: pageCount,
        filePath: filePath,
      });
      if (isOfficeDocument) {
        this.refreshedOfficeDocumentIds.add(docId);
      }
    } catch (error) {
      if (originalWasWritten) {
        fs.rmSync(filePath, { force: true });
      }
      if (isOfficeDocument) {
        fs.rmSync(this.getPdfPreviewPath(docId), { force: true });
      }
      throw error;
    }

    console.log('上传文件:', file.originalname, '页数:', pageCount, '路径:', filePath);

    return {
      id: docId,
      file_key: fileKey,
      file_name: file.originalname,
      file_type: fileType,
      file_size: file.size,
      page_count: pageCount,
      // 前端统一使用 file_url / url 读取，两个字段都提供
      file_url: `/api/documents/${docId}/preview`,
      url: `/api/documents/${docId}/preview`,
      preview_pdf_url: isOfficeDocument ? `/api/documents/${docId}/preview-pdf` : null,
      preview_status: isOfficeDocument ? 'ready' : 'not_applicable',
    };
  }

  async getDocumentById(docId: string) {
    const result = await db.select().from(documents).where(eq(documents.id, docId));
    const doc = result[0];
    if (!doc) {
      return null;
    }
    return this.toDocumentResponse(await this.refreshStoredOfficePageCount(doc));
  }

  async getDocumentsByUserId(userId: string) {
    const result = await db.select().from(documents).where(eq(documents.userId, userId));
    const documentsWithRefreshedPageCounts: StoredDocument[] = [];
    for (const doc of result) {
      // Process sequentially so a legacy user with many documents does not spawn many office suites.
      documentsWithRefreshedPageCounts.push(await this.refreshStoredOfficePageCount(doc));
    }
    return documentsWithRefreshedPageCounts.map(doc => this.toDocumentResponse(doc));
  }

  /** 返回文档的磁盘路径，供 controller 流式响应 */
  async getFilePath(docId: string): Promise<{ filePath: string | null; fileName: string; mimeType: string } | null> {
    const result = await db.select().from(documents).where(eq(documents.id, docId));
    const doc = result[0];
    if (!doc) return null;

    const mimeMap: Record<string, string> = {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      image: 'image/jpeg',
      other: 'application/octet-stream',
    };

    return {
      filePath: this.getManagedFilePath(doc.filePath),
      fileName: doc.fileName,
      mimeType: mimeMap[doc.fileType] || 'application/octet-stream',
    };
  }

  async getPdfPreviewFilePath(docId: string): Promise<{ filePath: string | null; fileName: string } | null> {
    const result = await db.select().from(documents).where(eq(documents.id, docId));
    const doc = result[0];
    if (!doc) {
      return null;
    }

    const extension = this.getFileExtension(doc.fileName);
    if (!OFFICE_FILE_EXTENSIONS.has(extension)) {
      throw new OfficePageCountException('unsupported_file_type', extension || 'unknown');
    }

    const previewPath = this.getPdfPreviewPath(doc.id);

    return {
      filePath: this.hasRegularFile(previewPath) ? previewPath : null,
      fileName: `${path.basename(doc.fileName, path.extname(doc.fileName)) || doc.id}.pdf`,
    };
  }

  async deleteDocument(docId: string) {
    // 同时删除磁盘文件
    const result = await db.select().from(documents).where(eq(documents.id, docId));
    const doc = result[0];
    const originalFilePath = doc ? this.getManagedFilePath(doc.filePath) : null;
    if (originalFilePath) {
      try { fs.unlinkSync(originalFilePath); } catch (_) { /* 忽略删除失败 */ }
    }
    fs.rmSync(this.getPdfPreviewPath(docId), { force: true });
    this.refreshedOfficeDocumentIds.delete(docId);
    await db.delete(documents).where(eq(documents.id, docId));
    return true;
  }
}
