const fs = require('fs').promises
const path = require('path')
const { exec } = require('child_process')
const { promisify } = require('util')
const { dnsDataAccess } = require('./database.cjs')

const execAsync = promisify(exec)

/**
 * DNS Backup and Disaster Recovery System
 * Provides automated backup, versioning, and recovery capabilities
 */
class DnsBackupManager {
  constructor() {
    this.backupDir = process.env.DNS_BACKUP_DIR || '/var/backups/dns'
    this.retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS) || 30
    this.compressionEnabled = process.env.BACKUP_COMPRESSION !== 'false'
  }

  /**
   * Initialize backup system
   */
  async initialize() {
    try {
      // Ensure backup directory exists
      await fs.mkdir(this.backupDir, { recursive: true })
      
      // Create subdirectories
      await fs.mkdir(path.join(this.backupDir, 'zones'), { recursive: true })
      await fs.mkdir(path.join(this.backupDir, 'database'), { recursive: true })
      await fs.mkdir(path.join(this.backupDir, 'config'), { recursive: true })
      
      console.log('DNS Backup Manager initialized')
    } catch (error) {
      throw new Error(`Failed to initialize backup system: ${error.message}`)
    }
  }

  /**
   * Perform complete DNS backup
   */
  async performFullBackup(tenantId = null) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupId = `full-backup-${timestamp}`
    
    try {
      console.log(`Starting full DNS backup: ${backupId}`)
      
      const backupPath = path.join(this.backupDir, backupId)
      await fs.mkdir(backupPath, { recursive: true })
      
      const backupManifest = {
        id: backupId,
        type: 'full',
        timestamp: new Date().toISOString(),
        tenantId,
        components: []
      }

      // Backup zones and records
      const zonesBackup = await this.backupZones(tenantId, backupPath)
      backupManifest.components.push(zonesBackup)

      // Backup database
      const databaseBackup = await this.backupDatabase(backupPath)
      backupManifest.components.push(databaseBackup)

      // Backup BIND configuration
      const configBackup = await this.backupBindConfig(backupPath)
      backupManifest.components.push(configBackup)

      // Backup TSIG keys
      const tsigBackup = await this.backupTsigKeys(tenantId, backupPath)
      backupManifest.components.push(tsigBackup)

      // Write backup manifest
      await fs.writeFile(
        path.join(backupPath, 'manifest.json'),
        JSON.stringify(backupManifest, null, 2)
      )

      // Compress backup if enabled
      if (this.compressionEnabled) {
        await this.compressBackup(backupPath)
      }

      console.log(`Full DNS backup completed: ${backupId}`)
      return backupManifest

    } catch (error) {
      throw new Error(`Full backup failed: ${error.message}`)
    }
  }

  /**
   * Backup DNS zones and records
   */
  async backupZones(tenantId, backupPath) {
    try {
      const zonesPath = path.join(backupPath, 'zones')
      await fs.mkdir(zonesPath, { recursive: true })

      const zones = await dnsDataAccess.getZones(tenantId, { limit: 1000 })
      const backupData = {
        zones: [],
        totalRecords: 0
      }

      for (const zone of zones) {
        const records = await dnsDataAccess.getRecords(tenantId, zone.name, { limit: 10000 })
        
        const zoneBackup = {
          zone: zone,
          records: records,
          recordCount: records.length
        }

        // Write zone backup file
        const zoneFileName = `${zone.name.replace(/\./g, '_')}.json`
        await fs.writeFile(
          path.join(zonesPath, zoneFileName),
          JSON.stringify(zoneBackup, null, 2)
        )

        // Generate BIND zone file
        const bindZoneFile = this.generateBindZoneFile(zone, records)
        await fs.writeFile(
          path.join(zonesPath, `${zone.name.replace(/\./g, '_')}.zone`),
          bindZoneFile
        )

        backupData.zones.push({
          name: zone.name,
          recordCount: records.length,
          fileName: zoneFileName
        })
        backupData.totalRecords += records.length
      }

      // Write zones summary
      await fs.writeFile(
        path.join(zonesPath, 'zones-summary.json'),
        JSON.stringify(backupData, null, 2)
      )

      return {
        component: 'zones',
        status: 'success',
        zonesCount: zones.length,
        recordsCount: backupData.totalRecords,
        path: 'zones/'
      }

    } catch (error) {
      throw new Error(`Zone backup failed: ${error.message}`)
    }
  }

  /**
   * Backup database
   */
  async backupDatabase(backupPath) {
    try {
      const dbPath = path.join(backupPath, 'database')
      await fs.mkdir(dbPath, { recursive: true })

      const dbName = process.env.DB_NAME || 'sagaos_dns'
      const dbUser = process.env.DB_USER || 'sagaos'
      const dbHost = process.env.DB_HOST || 'localhost'
      const dbPort = process.env.DB_PORT || 5432

      // Create PostgreSQL dump
      const dumpFile = path.join(dbPath, 'database.sql')
      const pgDumpCommand = `pg_dump -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -f ${dumpFile} --verbose`

      await execAsync(pgDumpCommand, { 
        env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD }
      })

      // Get database statistics
      const stats = await this.getDatabaseStats()
      await fs.writeFile(
        path.join(dbPath, 'database-stats.json'),
        JSON.stringify(stats, null, 2)
      )

      return {
        component: 'database',
        status: 'success',
        dumpFile: 'database.sql',
        stats: stats,
        path: 'database/'
      }

    } catch (error) {
      throw new Error(`Database backup failed: ${error.message}`)
    }
  }

  /**
   * Backup BIND configuration
   */
  async backupBindConfig(backupPath) {
    try {
      const configPath = path.join(backupPath, 'config')
      await fs.mkdir(configPath, { recursive: true })

      const bindConfigFiles = [
        '/etc/bind/named.conf',
        '/etc/bind/named.conf.local',
        '/etc/bind/named.conf.options'
      ]

      const backedUpFiles = []

      for (const configFile of bindConfigFiles) {
        try {
          const content = await fs.readFile(configFile, 'utf8')
          const fileName = path.basename(configFile)
          await fs.writeFile(path.join(configPath, fileName), content)
          backedUpFiles.push(fileName)
        } catch (error) {
          console.warn(`Could not backup ${configFile}: ${error.message}`)
        }
      }

      return {
        component: 'bind_config',
        status: 'success',
        files: backedUpFiles,
        path: 'config/'
      }

    } catch (error) {
      throw new Error(`BIND config backup failed: ${error.message}`)
    }
  }

  /**
   * Backup TSIG keys
   */
  async backupTsigKeys(tenantId, backupPath) {
    try {
      const keys = await dnsDataAccess.getTsigKeys(tenantId)
      
      // Remove secrets from backup (security)
      const keysForBackup = keys.map(key => ({
        name: key.name,
        algorithm: key.algorithm,
        created_at: key.created_at,
        last_used: key.last_used,
        usage_count: key.usage_count
      }))

      await fs.writeFile(
        path.join(backupPath, 'tsig-keys.json'),
        JSON.stringify(keysForBackup, null, 2)
      )

      return {
        component: 'tsig_keys',
        status: 'success',
        keyCount: keys.length,
        path: 'tsig-keys.json'
      }

    } catch (error) {
      throw new Error(`TSIG keys backup failed: ${error.message}`)
    }
  }

  /**
   * Generate BIND zone file from records
   */
  generateBindZoneFile(zone, records) {
    const timestamp = new Date().toISOString()
    let content = `; Zone file for ${zone.name}
; Backup generated on ${timestamp}
;
$TTL ${zone.minimum_ttl || 300}
$ORIGIN ${zone.name}.

`

    // Group records by type
    const recordsByType = {}
    for (const record of records) {
      if (!recordsByType[record.type]) {
        recordsByType[record.type] = []
      }
      recordsByType[record.type].push(record)
    }

    // Output records in logical order
    const typeOrder = ['SOA', 'NS', 'A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'PTR', 'CAA']

    for (const type of typeOrder) {
      if (recordsByType[type]) {
        content += `; ${type} Records\n`
        for (const record of recordsByType[type]) {
          const name = record.name === '@' ? '@' : record.name
          const ttl = record.ttl || zone.minimum_ttl || 300

          let value = record.value
          if (type === 'MX' && record.priority !== undefined) {
            value = `${record.priority} ${record.value}`
          } else if (type === 'SRV' && record.priority !== undefined) {
            value = `${record.priority} ${record.weight || 0} ${record.port || 0} ${record.value}`
          }

          content += `${name.padEnd(20)} ${ttl.toString().padEnd(8)} IN ${type.padEnd(8)} ${value}\n`
        }
        content += '\n'
      }
    }

    return content
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats() {
    try {
      const tenantId = '00000000-0000-0000-0000-000000000001' // Default tenant
      
      const zones = await dnsDataAccess.getZones(tenantId, { limit: 1000 })
      let totalRecords = 0
      
      for (const zone of zones) {
        const records = await dnsDataAccess.getRecords(tenantId, zone.name, { limit: 10000 })
        totalRecords += records.length
      }

      const tsigKeys = await dnsDataAccess.getTsigKeys(tenantId)

      return {
        zones: zones.length,
        records: totalRecords,
        tsigKeys: tsigKeys.length,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      return { error: error.message }
    }
  }

  /**
   * Compress backup directory
   */
  async compressBackup(backupPath) {
    try {
      const tarFile = `${backupPath}.tar.gz`
      const command = `tar -czf ${tarFile} -C ${path.dirname(backupPath)} ${path.basename(backupPath)}`
      
      await execAsync(command)
      
      // Remove uncompressed directory
      await fs.rm(backupPath, { recursive: true })
      
      console.log(`Backup compressed: ${tarFile}`)
      return tarFile
    } catch (error) {
      throw new Error(`Backup compression failed: ${error.message}`)
    }
  }

  /**
   * List available backups
   */
  async listBackups() {
    try {
      const files = await fs.readdir(this.backupDir)
      const backups = []

      for (const file of files) {
        const filePath = path.join(this.backupDir, file)
        const stats = await fs.stat(filePath)
        
        if (stats.isDirectory() || file.endsWith('.tar.gz')) {
          const manifestPath = stats.isDirectory() 
            ? path.join(filePath, 'manifest.json')
            : null

          let manifest = null
          if (manifestPath) {
            try {
              const manifestContent = await fs.readFile(manifestPath, 'utf8')
              manifest = JSON.parse(manifestContent)
            } catch (error) {
              // Manifest not found or invalid
            }
          }

          backups.push({
            name: file,
            path: filePath,
            size: stats.size,
            created: stats.birthtime,
            compressed: file.endsWith('.tar.gz'),
            manifest: manifest
          })
        }
      }

      return backups.sort((a, b) => b.created - a.created)
    } catch (error) {
      throw new Error(`Failed to list backups: ${error.message}`)
    }
  }

  /**
   * Clean up old backups
   */
  async cleanupOldBackups() {
    try {
      const backups = await this.listBackups()
      const cutoffDate = new Date(Date.now() - (this.retentionDays * 24 * 60 * 60 * 1000))
      
      let deletedCount = 0
      
      for (const backup of backups) {
        if (backup.created < cutoffDate) {
          if (backup.compressed) {
            await fs.unlink(backup.path)
          } else {
            await fs.rm(backup.path, { recursive: true })
          }
          deletedCount++
          console.log(`Deleted old backup: ${backup.name}`)
        }
      }

      console.log(`Cleanup completed: ${deletedCount} old backups deleted`)
      return deletedCount
    } catch (error) {
      throw new Error(`Backup cleanup failed: ${error.message}`)
    }
  }

  /**
   * Schedule automatic backups
   */
  scheduleBackups(intervalHours = 24) {
    const intervalMs = intervalHours * 60 * 60 * 1000
    
    setInterval(async () => {
      try {
        console.log('Starting scheduled DNS backup...')
        await this.performFullBackup()
        await this.cleanupOldBackups()
        console.log('Scheduled DNS backup completed')
      } catch (error) {
        console.error('Scheduled backup failed:', error)
      }
    }, intervalMs)

    console.log(`DNS backups scheduled every ${intervalHours} hours`)
  }
}

// Create singleton instance
const dnsBackupManager = new DnsBackupManager()

module.exports = {
  DnsBackupManager,
  dnsBackupManager
}
