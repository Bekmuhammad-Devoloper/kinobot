import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as os from 'os';
import { promisify } from 'util';
import { exec as execCb } from 'child_process';

const exec = promisify(execCb);

@Injectable()
export class SystemInfoService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getSystemStats() {
    const [disk, dbSize, dbTablesSize] = await Promise.all([
      this.getDiskUsage(),
      this.getDatabaseSize(),
      this.getTablesSize(),
    ]);

    const memTotal = os.totalmem();
    const memFree = os.freemem();
    const memUsed = memTotal - memFree;

    const loadAvg = os.loadavg();
    const cpuCount = os.cpus().length;

    return {
      uptime: os.uptime(),
      platform: os.platform(),
      hostname: os.hostname(),
      memory: {
        total: memTotal,
        used: memUsed,
        free: memFree,
        usedPercent: (memUsed / memTotal) * 100,
      },
      cpu: {
        count: cpuCount,
        loadAvg: loadAvg,
        usagePercent: Math.min(100, (loadAvg[0] / cpuCount) * 100),
      },
      disk,
      database: {
        sizeBytes: dbSize,
        tables: dbTablesSize,
      },
    };
  }

  private async getDiskUsage(): Promise<{ total: number; used: number; free: number; usedPercent: number; mountPath: string }> {
    try {
      // df -B1 / => 1-byte blocks
      const { stdout } = await exec('df -B1 / | tail -n 1');
      const parts = stdout.trim().split(/\s+/);
      // parts: [filesystem, total, used, free, use%, mount]
      const total = parseInt(parts[1] || '0');
      const used = parseInt(parts[2] || '0');
      const free = parseInt(parts[3] || '0');
      return {
        total,
        used,
        free,
        usedPercent: total > 0 ? (used / total) * 100 : 0,
        mountPath: parts[5] || '/',
      };
    } catch {
      return { total: 0, used: 0, free: 0, usedPercent: 0, mountPath: 'unknown' };
    }
  }

  private async getDatabaseSize(): Promise<number> {
    try {
      const result = await this.dataSource.query(
        "SELECT pg_database_size(current_database()) AS size",
      );
      return parseInt(result[0]?.size || '0');
    } catch {
      return 0;
    }
  }

  private async getTablesSize(): Promise<Array<{ table: string; size: number; rows: number }>> {
    try {
      const result = await this.dataSource.query(`
        SELECT
          relname AS table,
          pg_total_relation_size(C.oid) AS size,
          n_live_tup AS rows
        FROM pg_class C
        LEFT JOIN pg_namespace N ON (N.oid = C.relnamespace)
        LEFT JOIN pg_stat_user_tables S ON (S.relname = C.relname)
        WHERE nspname = 'public' AND C.relkind = 'r'
        ORDER BY pg_total_relation_size(C.oid) DESC;
      `);
      return result.map((r: any) => ({
        table: r.table,
        size: parseInt(r.size || '0'),
        rows: parseInt(r.rows || '0'),
      }));
    } catch {
      return [];
    }
  }
}
