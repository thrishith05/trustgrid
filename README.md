# CivicFix - AI-Powered Civic Issue Reporting System

A Flutter-based mobile application that uses AI and AR to automatically detect, classify, and report civic issues in real-time.

## Features

### 🤖 AI-Powered Detection
- Real-time issue detection using TensorFlow Lite
- Automatic classification of civic issues (potholes, streetlights, trash, etc.)
- Confidence scoring and severity assessment
- Duplicate detection using perceptual hashing

### 📱 AR-Enhanced Interface
- ARCore/ARKit integration for enhanced user experience
- Real-time AR overlays showing detected issues
- One-tap reporting with automatic metadata capture

### 📍 Location Services
- Automatic GPS location tagging
- Address resolution using geocoding
- Location-based duplicate detection

### 🎯 Smart Reporting
- Pre-filled reports with AI-detected information
- Voice note support for additional context
- Automatic submission to backend API
- Local storage for offline capability

## Tech Stack

- **Frontend**: Flutter (Dart)
- **AI/ML**: TensorFlow Lite, MediaPipe
- **AR**: ARCore (Android), ARKit (iOS)
- **Location**: Geolocator, Geocoding
- **State Management**: Provider
- **Backend**: REST API (Node.js/Express planned)

## Project Structure

```
lib/
├── main.dart                 # App entry point
├── models/
│   └── civic_issue.dart     # Data models
├── services/
│   ├── ai_service.dart      # AI/ML processing
│   ├── location_service.dart # GPS and geocoding
│   └── report_service.dart  # API communication
├── providers/
│   └── civic_report_provider.dart # State management
├── screens/
│   ├── home_screen.dart     # Main dashboard
│   └── camera_screen.dart   # AR camera interface
└── widgets/
    ├── report_card.dart     # Issue display cards
    ├── stats_card.dart      # Statistics display
    └── issue_detection_overlay.dart # AR overlays
```

## Getting Started

### Prerequisites

- Flutter SDK (>=3.0.0)
- Android Studio / Xcode
- Android device with ARCore support / iOS device with ARKit support

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd civic-fix
```

2. Install dependencies:
```bash
flutter pub get
```

3. Run the app:
```bash
flutter run
```

### Configuration

1. **AI Model**: Place your trained TensorFlow Lite model in `assets/models/civic_issues_model.tflite`

2. **API Endpoint**: Update the base URL in `lib/services/report_service.dart`

3. **Permissions**: Ensure camera and location permissions are granted

## Key Features Implementation

### 1. AI Detection Pipeline
- Continuous camera frame processing
- Real-time issue classification
- Confidence-based severity assessment
- Perceptual hashing for duplicate detection

### 2. AR Integration
- ARCore/ARKit camera integration
- Real-time bounding box overlays
- Interactive issue highlighting
- One-tap capture functionality

### 3. Location Services
- High-accuracy GPS positioning
- Automatic address resolution
- Location-based duplicate checking
- Geofencing for issue clustering

### 4. Report Management
- Automatic report generation
- Local storage with sync capability
- Status tracking and updates
- Analytics and reporting

## Development Status

- ✅ Project structure setup
- ✅ Flutter app scaffolding
- ✅ AR camera integration
- ✅ AI service framework
- ✅ Location services
- ✅ Report management
- ✅ UI components
- 🔄 Backend API integration (planned)
- 🔄 Admin dashboard (planned)
- 🔄 Push notifications (planned)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions, please open an issue in the repository.
