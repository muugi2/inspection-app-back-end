import 'package:flutter/foundation.dart';
import 'package:app/services/api.dart';
import 'package:app/utils/api_response_parser.dart';

/// Centralized inspection data state management
class InspectionProvider extends ChangeNotifier {
  List<Map<String, dynamic>> _assignedInspections = [];
  List<Map<String, dynamic>> _assignedRepairs = [];
  List<Map<String, dynamic>> _assignedInstallations = [];

  bool _isLoadingInspections = false;
  bool _isLoadingRepairs = false;
  bool _isLoadingInstallations = false;

  String? _inspectionsError;
  String? _repairsError;
  String? _installationsError;

  // Getters
  List<Map<String, dynamic>> get assignedInspections => _assignedInspections;
  List<Map<String, dynamic>> get assignedRepairs => _assignedRepairs;
  List<Map<String, dynamic>> get assignedInstallations =>
      _assignedInstallations;

  bool get isLoadingInspections => _isLoadingInspections;
  bool get isLoadingRepairs => _isLoadingRepairs;
  bool get isLoadingInstallations => _isLoadingInstallations;

  String? get inspectionsError => _inspectionsError;
  String? get repairsError => _repairsError;
  String? get installationsError => _installationsError;

  /// Load assigned inspections
  Future<void> loadAssignedInspections() async {
    _isLoadingInspections = true;
    _inspectionsError = null;
    notifyListeners();

    try {
      final response = await InspectionAPI.getAssignedByType('inspection');
      final rawItems = ApiResponseParser.parseListResponse(response);

      _assignedInspections = rawItems
          .map((item) => ApiResponseParser.parseInspectionItem(item))
          .where((item) => item['id'].toString().isNotEmpty)
          .toList();
    } catch (e) {
      _inspectionsError = ApiResponseParser.extractErrorMessage(e);
    } finally {
      _isLoadingInspections = false;
      notifyListeners();
    }
  }

  /// Load assigned repairs
  Future<void> loadAssignedRepairs() async {
    _isLoadingRepairs = true;
    _repairsError = null;
    notifyListeners();

    try {
      final response = await InspectionAPI.getAssignedByType('maintenance');
      final rawItems = ApiResponseParser.parseListResponse(response);

      _assignedRepairs = rawItems
          .map((item) => ApiResponseParser.parseInspectionItem(item))
          .where((item) => item['id'].toString().isNotEmpty)
          .toList();
    } catch (e) {
      _repairsError = ApiResponseParser.extractErrorMessage(e);
    } finally {
      _isLoadingRepairs = false;
      notifyListeners();
    }
  }

  /// Load assigned installations
  Future<void> loadAssignedInstallations() async {
    _isLoadingInstallations = true;
    _installationsError = null;
    notifyListeners();

    try {
      final response = await InspectionAPI.getAssignedByType('installation');
      final rawItems = ApiResponseParser.parseListResponse(response);

      _assignedInstallations = rawItems
          .map((item) => ApiResponseParser.parseInspectionItem(item))
          .where((item) => item['id'].toString().isNotEmpty)
          .toList();
    } catch (e) {
      _installationsError = ApiResponseParser.extractErrorMessage(e);
    } finally {
      _isLoadingInstallations = false;
      notifyListeners();
    }
  }

  /// Load all assigned items
  Future<void> loadAllAssignedItems() async {
    await Future.wait([
      loadAssignedInspections(),
      loadAssignedRepairs(),
      loadAssignedInstallations(),
    ]);
  }

  /// Refresh specific type
  Future<void> refreshType(String type) async {
    switch (type.toLowerCase()) {
      case 'inspection':
        await loadAssignedInspections();
        break;
      case 'repair':
      case 'maintenance':
        await loadAssignedRepairs();
        break;
      case 'install':
      case 'installation':
        await loadAssignedInstallations();
        break;
    }
  }

  /// Clear errors
  void clearErrors() {
    _inspectionsError = null;
    _repairsError = null;
    _installationsError = null;
    notifyListeners();
  }
}

