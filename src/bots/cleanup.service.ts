import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class CleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CleanupService.name);
  private timer: NodeJS.Timeout | null = null;

  // Saqlanadigan kunlar (eski user_views shu davrdan eski bo'lsa o'chiriladi)
  private readonly RETAIN_VIEWS_DAYS = 90;
  // Cleanup interval — har 12 soatda
  private readonly INTERVAL_MS = 12 * 3600 * 1000;
  // Birinchi run kechikishi
  private readonly INITIAL_DELAY_MS = 60 * 1000;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async onModuleInit() {
    // Birinchi run kechiktiriladi (server boot paytida yuk yaratmasin)
    setTimeout(() => this.runCleanup().catch(() => {}), this.INITIAL_DELAY_MS);
    this.timer = setInterval(() => this.runCleanup().catch(() => {}), this.INTERVAL_MS);
    this.logger.log(`📦 Cleanup service ishga tushdi (har ${this.INTERVAL_MS / 3600000} soatda)`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async runCleanup() {
    const start = Date.now();
    try {
      // 1) Eski user_views o'chirish — 90 kundan eski
      const r1 = await this.dataSource.query(
        `DELETE FROM user_views WHERE viewed_at < NOW() - INTERVAL '${this.RETAIN_VIEWS_DAYS} days'`,
      );
      const deleted = r1?.[1] || 0;

      // 2) ban bo'lgan va 180 kundan beri faollashmagan user'larni tozalash (ixtiyoriy)
      // (Hozircha biz user'larni saqlab qolamiz - ular bot user count uchun kerak)

      // 3) PostgreSQL'ga DB hajmini optimallash imkonini berish
      // Bu so'rov transaction tashqarisida bo'lishi kerak.
      const client = await this.dataSource.driver.obtainMasterConnection();
      try {
        await client.query('VACUUM (ANALYZE) user_views');
        await client.query('VACUUM (ANALYZE) movies');
        await client.query('VACUUM (ANALYZE) users');
      } finally {
        // typeorm pool clientni qaytaradi
        if (typeof (this.dataSource.driver as any).releaseMasterConnection === 'function') {
          await (this.dataSource.driver as any).releaseMasterConnection(client);
        }
      }

      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      this.logger.log(`✓ Cleanup tugadi (${elapsed}s) — ${deleted} eski view o'chirildi, VACUUM bajarildi`);
    } catch (e) {
      this.logger.error(`Cleanup xatosi: ${e?.message || e}`);
    }
  }

  // Public API — qo'lda chaqirish uchun
  async manualCleanup(): Promise<{ deleted_views: number; duration_ms: number }> {
    const start = Date.now();
    const r = await this.dataSource.query(
      `DELETE FROM user_views WHERE viewed_at < NOW() - INTERVAL '${this.RETAIN_VIEWS_DAYS} days'`,
    );
    return { deleted_views: r?.[1] || 0, duration_ms: Date.now() - start };
  }
}
