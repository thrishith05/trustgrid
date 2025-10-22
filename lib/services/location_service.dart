import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';
import 'package:permission_handler/permission_handler.dart';

class LocationService {
  static bool _isInitialized = false;

  static Future<void> initialize() async {
    if (_isInitialized) return;
    
    // Check if location services are enabled
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      throw Exception('Location services are disabled.');
    }

    // Check location permissions
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        throw Exception('Location permissions are denied');
      }
    }

    if (permission == LocationPermission.deniedForever) {
      throw Exception('Location permissions are permanently denied');
    }

    _isInitialized = true;
  }

  static Future<Position> getCurrentPosition() async {
    if (!_isInitialized) {
      await initialize();
    }

    try {
      return await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 10),
      );
    } catch (e) {
      throw Exception('Failed to get current position: $e');
    }
  }

  static Future<String> getAddressFromCoordinates(double latitude, double longitude) async {
    try {
      print('Geocoding coordinates: $latitude, $longitude');
      
      List<Placemark> placemarks = await placemarkFromCoordinates(
        latitude, 
        longitude,
        localeIdentifier: 'en_US',
      ).timeout(
        const Duration(seconds: 10),
        onTimeout: () {
          print('Geocoding timeout - using coordinates');
          return [];
        },
      );
      
      if (placemarks.isNotEmpty) {
        Placemark place = placemarks[0];
        final address = _formatAddress(place);
        print('Geocoded address: $address');
        return address;
      }
      
      // Fallback to coordinates if no address found
      final fallback = '${latitude.toStringAsFixed(6)}, ${longitude.toStringAsFixed(6)}';
      print('No placemark found, using coordinates: $fallback');
      return fallback;
    } catch (e) {
      print('Error getting address: $e');
      // Return coordinates as fallback
      return '${latitude.toStringAsFixed(6)}, ${longitude.toStringAsFixed(6)}';
    }
  }

  static String _formatAddress(Placemark place) {
    List<String> addressParts = [];
    
    if (place.street != null && place.street!.isNotEmpty) {
      addressParts.add(place.street!);
    }
    if (place.subLocality != null && place.subLocality!.isNotEmpty) {
      addressParts.add(place.subLocality!);
    }
    if (place.locality != null && place.locality!.isNotEmpty) {
      addressParts.add(place.locality!);
    }
    if (place.administrativeArea != null && place.administrativeArea!.isNotEmpty) {
      addressParts.add(place.administrativeArea!);
    }
    if (place.country != null && place.country!.isNotEmpty) {
      addressParts.add(place.country!);
    }
    
    // If no parts, try other fields
    if (addressParts.isEmpty) {
      if (place.name != null && place.name!.isNotEmpty) {
        addressParts.add(place.name!);
      }
      if (place.postalCode != null && place.postalCode!.isNotEmpty) {
        addressParts.add(place.postalCode!);
      }
    }
    
    return addressParts.isNotEmpty ? addressParts.join(', ') : 'Location';
  }

  static Future<double> calculateDistance(
    double lat1, double lon1, double lat2, double lon2) async {
    return Geolocator.distanceBetween(lat1, lon1, lat2, lon2);
  }

  static Future<bool> isLocationPermissionGranted() async {
    LocationPermission permission = await Geolocator.checkPermission();
    return permission == LocationPermission.whileInUse || 
           permission == LocationPermission.always;
  }

  static Future<void> requestLocationPermission() async {
    await Permission.locationWhenInUse.request();
  }
}
