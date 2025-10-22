const database = require('../config/database');

/**
 * Advanced Duplicate Detection Service
 * Uses perceptual hash (pHash) and geospatial proximity to find duplicates
 */

class DuplicateDetectionService {
  constructor() {
    this.distanceThreshold = parseInt(process.env.DUPLICATE_DISTANCE_THRESHOLD) || 100; // meters
    this.hashThreshold = parseInt(process.env.DUPLICATE_HASH_THRESHOLD) || 80; // percentage
  }

  /**
   * Calculate Hamming distance between two perceptual hashes
   */
  calculateHashSimilarity(hash1, hash2) {
    if (!hash1 || !hash2 || hash1.length !== hash2.length) return 0;
    
    let similarity = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] === hash2[i]) similarity++;
    }
    
    return (similarity / hash1.length) * 100;
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * Find potential duplicate reports
   */
  async findDuplicates(perceptualHash, latitude, longitude, radius = null) {
    const searchRadius = radius || this.distanceThreshold;
    
    try {
      // Step 1: Find all reports within search radius using bounding box
      // This is much faster than calculating exact distance for all reports
      const latDelta = (searchRadius / 111000); // Approximate degrees latitude
      const lonDelta = (searchRadius / (111000 * Math.cos(latitude * Math.PI / 180))); // Approximate degrees longitude

      const query = `
        SELECT id, perceptual_hash, latitude, longitude, type, severity, status, image_path, created_at
        FROM reports 
        WHERE latitude BETWEEN ? AND ?
          AND longitude BETWEEN ? AND ?
          AND status NOT IN ('duplicate', 'closed')
        ORDER BY created_at DESC
        LIMIT 100
      `;

      const nearbyReports = await database.query(query, [
        latitude - latDelta,
        latitude + latDelta,
        longitude - lonDelta,
        longitude + lonDelta
      ]);

      // Step 2: Calculate exact distance and hash similarity
      const potentialDuplicates = [];
      
      for (const report of nearbyReports) {
        const distance = this.calculateDistance(
          latitude, longitude,
          report.latitude, report.longitude
        );

        if (distance <= searchRadius) {
          const hashSimilarity = this.calculateHashSimilarity(
            perceptualHash,
            report.perceptual_hash
          );

          if (hashSimilarity >= this.hashThreshold) {
            potentialDuplicates.push({
              ...report,
              distance: Math.round(distance),
              similarity: Math.round(hashSimilarity * 10) / 10,
              matchScore: this.calculateMatchScore(distance, hashSimilarity)
            });
          }
        }
      }

      // Sort by match score (combination of proximity and similarity)
      potentialDuplicates.sort((a, b) => b.matchScore - a.matchScore);

      return {
        isDuplicate: potentialDuplicates.length > 0,
        duplicates: potentialDuplicates,
        count: potentialDuplicates.length
      };

    } catch (error) {
      console.error('Error finding duplicates:', error);
      throw error;
    }
  }

  /**
   * Calculate match score (0-100) based on distance and hash similarity
   * Closer and more similar = higher score
   */
  calculateMatchScore(distance, hashSimilarity) {
    // Normalize distance (0-100, where 0m = 100, distanceThreshold = 0)
    const distanceScore = Math.max(0, 100 - (distance / this.distanceThreshold) * 100);
    
    // Weight: 60% hash similarity, 40% proximity
    return (hashSimilarity * 0.6) + (distanceScore * 0.4);
  }

  /**
   * Check if report should be marked as duplicate and create cluster
   */
  async checkAndMarkDuplicate(reportId, perceptualHash, latitude, longitude) {
    const result = await this.findDuplicates(perceptualHash, latitude, longitude);
    
    if (result.isDuplicate && result.duplicates.length > 0) {
      const bestMatch = result.duplicates[0];
      
      // Mark as duplicate if match score is very high (>= 85)
      if (bestMatch.matchScore >= 85) {
        await database.run(
          'UPDATE reports SET status = ?, duplicate_of = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          ['duplicate', bestMatch.id, reportId]
        );

        // Update duplicate cluster or create new one
        await this.updateDuplicateCluster(bestMatch.id, latitude, longitude);

        // Log activity
        await database.run(
          'INSERT INTO activity_log (report_id, action, details) VALUES (?, ?, ?)',
          [reportId, 'marked_duplicate', `Duplicate of report ${bestMatch.id} (${bestMatch.matchScore.toFixed(1)}% match)`]
        );

        return {
          isDuplicate: true,
          duplicateOf: bestMatch.id,
          matchScore: bestMatch.matchScore
        };
      }
    }

    return { isDuplicate: false };
  }

  /**
   * Update or create duplicate cluster
   */
  async updateDuplicateCluster(parentReportId, latitude, longitude) {
    const existingCluster = await database.get(
      'SELECT * FROM duplicate_clusters WHERE parent_report_id = ?',
      [parentReportId]
    );

    if (existingCluster) {
      // Update cluster
      await database.run(
        'UPDATE duplicate_clusters SET report_count = report_count + 1 WHERE parent_report_id = ?',
        [parentReportId]
      );
    } else {
      // Create new cluster
      await database.run(
        'INSERT INTO duplicate_clusters (parent_report_id, latitude, longitude, radius, report_count) VALUES (?, ?, ?, ?, ?)',
        [parentReportId, latitude, longitude, this.distanceThreshold, 1]
      );
    }
  }

  /**
   * Get all duplicate clusters
   */
  async getDuplicateClusters() {
    return await database.query(`
      SELECT dc.*, r.type, r.severity, r.address, r.image_path
      FROM duplicate_clusters dc
      JOIN reports r ON dc.parent_report_id = r.id
      WHERE dc.report_count > 1
      ORDER BY dc.report_count DESC
    `);
  }
}

module.exports = new DuplicateDetectionService();

