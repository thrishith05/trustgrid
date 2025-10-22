import 'dart:typed_data';

enum IssueType {
  pothole,
  streetlight,
  trash,
  graffiti,
  damagedSign,
  brokenSidewalk,
  waterLeak,
  other
}

enum IssueSeverity {
  low,
  medium,
  high,
  critical
}

enum IssueStatus {
  reported,
  acknowledged,
  inProgress,
  resolved,
  closed
}

class CivicIssue {
  final String id;
  final IssueType type;
  final IssueSeverity severity;
  final IssueStatus status;
  final double latitude;
  final double longitude;
  final String address;
  final DateTime timestamp;
  final String? description;
  final String? voiceNotePath;
  final String imagePath;
  final String perceptualHash;
  final String? assignedDepartment;
  final String? assignedTo;
  final DateTime? acknowledgedAt;
  final DateTime? resolvedAt;
  final String? resolutionNotes;
  final String? beforeImagePath;
  final String? afterImagePath;
  final int verificationCount;
  final List<String> verifiedBy;
  final int civicCoinsAwarded;

  CivicIssue({
    required this.id,
    required this.type,
    required this.severity,
    required this.status,
    required this.latitude,
    required this.longitude,
    required this.address,
    required this.timestamp,
    this.description,
    this.voiceNotePath,
    required this.imagePath,
    required this.perceptualHash,
    this.assignedDepartment,
    this.assignedTo,
    this.acknowledgedAt,
    this.resolvedAt,
    this.resolutionNotes,
    this.beforeImagePath,
    this.afterImagePath,
    this.verificationCount = 0,
    this.verifiedBy = const [],
    this.civicCoinsAwarded = 0,
  });

  factory CivicIssue.fromJson(Map<String, dynamic> json) {
    return CivicIssue(
      id: json['id'],
      type: IssueType.values.firstWhere(
        (e) => e.toString() == 'IssueType.${json['type']}',
        orElse: () => IssueType.other,
      ),
      severity: IssueSeverity.values.firstWhere(
        (e) => e.toString() == 'IssueSeverity.${json['severity']}',
        orElse: () => IssueSeverity.medium,
      ),
      status: IssueStatus.values.firstWhere(
        (e) => e.toString() == 'IssueStatus.${json['status']}',
        orElse: () => IssueStatus.reported,
      ),
      latitude: json['latitude'].toDouble(),
      longitude: json['longitude'].toDouble(),
      address: json['address'],
      timestamp: DateTime.parse(json['timestamp']),
      description: json['description'],
      voiceNotePath: json['voiceNotePath'],
      imagePath: json['imagePath'],
      perceptualHash: json['perceptualHash'],
      assignedDepartment: json['assignedDepartment'],
      assignedTo: json['assignedTo'],
      acknowledgedAt: json['acknowledgedAt'] != null 
          ? DateTime.parse(json['acknowledgedAt']) 
          : null,
      resolvedAt: json['resolvedAt'] != null 
          ? DateTime.parse(json['resolvedAt']) 
          : null,
      resolutionNotes: json['resolutionNotes'],
      beforeImagePath: json['beforeImagePath'],
      afterImagePath: json['afterImagePath'],
      verificationCount: json['verificationCount'] ?? 0,
      verifiedBy: List<String>.from(json['verifiedBy'] ?? []),
      civicCoinsAwarded: json['civicCoinsAwarded'] ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'type': type.toString().split('.').last,
      'severity': severity.toString().split('.').last,
      'status': status.toString().split('.').last,
      'latitude': latitude,
      'longitude': longitude,
      'address': address,
      'timestamp': timestamp.toIso8601String(),
      'description': description,
      'voiceNotePath': voiceNotePath,
      'imagePath': imagePath,
      'perceptualHash': perceptualHash,
      'assignedDepartment': assignedDepartment,
      'assignedTo': assignedTo,
      'acknowledgedAt': acknowledgedAt?.toIso8601String(),
      'resolvedAt': resolvedAt?.toIso8601String(),
      'resolutionNotes': resolutionNotes,
      'beforeImagePath': beforeImagePath,
      'afterImagePath': afterImagePath,
      'verificationCount': verificationCount,
      'verifiedBy': verifiedBy,
      'civicCoinsAwarded': civicCoinsAwarded,
    };
  }

  CivicIssue copyWith({
    String? id,
    IssueType? type,
    IssueSeverity? severity,
    IssueStatus? status,
    double? latitude,
    double? longitude,
    String? address,
    DateTime? timestamp,
    String? description,
    String? voiceNotePath,
    String? imagePath,
    String? perceptualHash,
    String? assignedDepartment,
    String? assignedTo,
    DateTime? acknowledgedAt,
    DateTime? resolvedAt,
    String? resolutionNotes,
    String? beforeImagePath,
    String? afterImagePath,
    int? verificationCount,
    List<String>? verifiedBy,
    int? civicCoinsAwarded,
  }) {
    return CivicIssue(
      id: id ?? this.id,
      type: type ?? this.type,
      severity: severity ?? this.severity,
      status: status ?? this.status,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      address: address ?? this.address,
      timestamp: timestamp ?? this.timestamp,
      description: description ?? this.description,
      voiceNotePath: voiceNotePath ?? this.voiceNotePath,
      imagePath: imagePath ?? this.imagePath,
      perceptualHash: perceptualHash ?? this.perceptualHash,
      assignedDepartment: assignedDepartment ?? this.assignedDepartment,
      assignedTo: assignedTo ?? this.assignedTo,
      acknowledgedAt: acknowledgedAt ?? this.acknowledgedAt,
      resolvedAt: resolvedAt ?? this.resolvedAt,
      resolutionNotes: resolutionNotes ?? this.resolutionNotes,
      beforeImagePath: beforeImagePath ?? this.beforeImagePath,
      afterImagePath: afterImagePath ?? this.afterImagePath,
      verificationCount: verificationCount ?? this.verificationCount,
      verifiedBy: verifiedBy ?? this.verifiedBy,
      civicCoinsAwarded: civicCoinsAwarded ?? this.civicCoinsAwarded,
    );
  }

  String get typeDisplayName {
    switch (type) {
      case IssueType.pothole:
        return 'Pothole';
      case IssueType.streetlight:
        return 'Streetlight';
      case IssueType.trash:
        return 'Trash/Overflow';
      case IssueType.graffiti:
        return 'Graffiti';
      case IssueType.damagedSign:
        return 'Damaged Sign';
      case IssueType.brokenSidewalk:
        return 'Broken Sidewalk';
      case IssueType.waterLeak:
        return 'Water Leak';
      case IssueType.other:
        return 'Other';
    }
  }

  String get severityDisplayName {
    switch (severity) {
      case IssueSeverity.low:
        return 'Low';
      case IssueSeverity.medium:
        return 'Medium';
      case IssueSeverity.high:
        return 'High';
      case IssueSeverity.critical:
        return 'Critical';
    }
  }

  String get statusDisplayName {
    switch (status) {
      case IssueStatus.reported:
        return 'Reported';
      case IssueStatus.acknowledged:
        return 'Acknowledged';
      case IssueStatus.inProgress:
        return 'In Progress';
      case IssueStatus.resolved:
        return 'Resolved';
      case IssueStatus.closed:
        return 'Closed';
    }
  }
}
