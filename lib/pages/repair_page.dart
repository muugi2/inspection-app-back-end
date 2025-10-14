import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:app/widgets/assigned_list.dart';
import 'package:app/services/api.dart';

/// Repair page with device and model management
class RepairPage extends StatefulWidget {
  const RepairPage({super.key});

  @override
  State<RepairPage> createState() => _RepairPageState();
}

class _RepairPageState extends State<RepairPage> with TickerProviderStateMixin {
  late TabController _tabController;
  List<dynamic> _devices = [];
  List<dynamic> _deviceModels = [];
  bool _isLoadingDevices = true;
  bool _isLoadingModels = true;
  String _devicesError = '';
  String _modelsError = '';

  // Selected items
  String? _selectedDeviceId;
  String? _selectedModelId;
  Map<String, dynamic>? _selectedDeviceDetails;
  Map<String, dynamic>? _selectedModelDetails;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  /// Load both devices and models
  Future<void> _loadData() async {
    await Future.wait([_loadDevices(), _loadDeviceModels()]);
  }

  /// Load devices from API
  Future<void> _loadDevices() async {
    try {
      setState(() {
        _isLoadingDevices = true;
        _devicesError = '';
      });

      final response = await InspectionAPI.getDevices();
      final devices = _parseApiResponse(response);

      setState(() {
        _devices = _removeDuplicateDevices(devices);
        _isLoadingDevices = false;
      });
    } catch (e) {
      setState(() {
        _devicesError = 'Төхөөрөмжийн мэдээлэл татахад алдаа гарлаа: $e';
        _isLoadingDevices = false;
        _devices = [];
      });
    }
  }

  /// Load device models from API
  Future<void> _loadDeviceModels() async {
    try {
      setState(() {
        _isLoadingModels = true;
        _modelsError = '';
      });

      final response = await InspectionAPI.getDeviceModels();
      final models = _parseApiResponse(response);

      setState(() {
        _deviceModels = models;
        _isLoadingModels = false;
      });
    } catch (e) {
      setState(() {
        _modelsError =
            'Төхөөрөмжийн загварын мэдээлэл татахад алдаа гарлаа: $e';
        _isLoadingModels = false;
        _deviceModels = [];
      });
    }
  }

  /// Parse API response to extract data
  List<dynamic> _parseApiResponse(dynamic response) {
    if (response is Map<String, dynamic>) {
      final data =
          response['data'] ??
          response['items'] ??
          response['result'] ??
          response['devices'] ??
          response['models'] ??
          response['deviceModels'] ??
          response['rows'];
      return data is List ? data : [];
    }
    return response is List ? response : [];
  }

  /// Remove duplicate devices by ID
  List<dynamic> _removeDuplicateDevices(List<dynamic> devices) {
    final uniqueDevices = <String, dynamic>{};
    for (final device in devices) {
      if (device is Map<String, dynamic>) {
        final id = device['id']?.toString();
        if (id != null && id.isNotEmpty) {
          uniqueDevices[id] = device;
        }
      }
    }
    return uniqueDevices.values.toList();
  }

  /// Handle device selection
  void _onDeviceSelected(String? deviceId) {
    setState(() {
      _selectedDeviceId = deviceId;
      _selectedDeviceDetails = deviceId != null
          ? _devices.firstWhere(
              (device) => device['id'].toString() == deviceId,
              orElse: () => null,
            )
          : null;
    });
  }

  /// Handle model selection
  void _onModelSelected(String? modelId) {
    setState(() {
      _selectedModelId = modelId;
      _selectedModelDetails = modelId != null
          ? _deviceModels.firstWhere(
              (model) => model['id'].toString() == modelId,
              orElse: () => null,
            )
          : null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: TabBar(
        controller: _tabController,
        tabs: const [
          Tab(text: 'Засвар'),
          Tab(text: 'Төхөөрөмжүүд'),
          Tab(text: 'Загварууд'),
        ],
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          const AssignedList(type: 'repair'),
          _buildDevicesTab(),
          _buildModelsTab(),
        ],
      ),
    );
  }

  /// Build devices tab content
  Widget _buildDevicesTab() {
    return _buildTabContent(
      isLoading: _isLoadingDevices,
      error: _devicesError,
      isEmpty: _devices.isEmpty,
      onRefresh: _loadDevices,
      emptyIcon: Icons.devices_other,
      emptyText: 'Төхөөрөмж олдсонгүй',
      content: _buildDeviceSelection(),
    );
  }

  /// Build models tab content
  Widget _buildModelsTab() {
    return _buildTabContent(
      isLoading: _isLoadingModels,
      error: _modelsError,
      isEmpty: _deviceModels.isEmpty,
      onRefresh: _loadDeviceModels,
      emptyIcon: Icons.category,
      emptyText: 'Төхөөрөмжийн загвар олдсонгүй',
      content: _buildModelSelection(),
    );
  }

  /// Generic tab content builder
  Widget _buildTabContent({
    required bool isLoading,
    required String error,
    required bool isEmpty,
    required Future<void> Function() onRefresh,
    required IconData emptyIcon,
    required String emptyText,
    required Widget content,
  }) {
    if (isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (error.isNotEmpty) {
      return _buildErrorWidget(error, onRefresh);
    }

    if (isEmpty) {
      return _buildEmptyWidget(emptyIcon, emptyText);
    }

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: Padding(padding: const EdgeInsets.all(16.0), child: content),
    );
  }

  /// Build error widget
  Widget _buildErrorWidget(String error, VoidCallback onRetry) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.error_outline, size: 64, color: Colors.red[300]),
          const SizedBox(height: 16),
          Text(
            error,
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.red[600]),
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: onRetry,
            child: const Text('Дахин оролдох'),
          ),
        ],
      ),
    );
  }

  /// Build empty widget
  Widget _buildEmptyWidget(IconData icon, String text) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 64, color: Colors.grey),
          const SizedBox(height: 16),
          Text(text, style: const TextStyle(fontSize: 18, color: Colors.grey)),
        ],
      ),
    );
  }

  /// Build device selection interface
  Widget _buildDeviceSelection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSelectionCard(
          title: 'Төхөөрөмж сонгох:',
          hint: 'Төхөөрөмжийн ID сонгоно уу',
          value: _selectedDeviceId,
          items: _devices,
          onChanged: _onDeviceSelected,
          itemBuilder: _buildDeviceItem,
        ),
        const SizedBox(height: 16),
        if (_selectedDeviceDetails != null) ...[
          _buildDetailsCard(
            icon: Icons.info_outline,
            title: 'Төхөөрөмжийн дэлгэрэнгүй мэдээлэл',
            color: Colors.blue,
            details: _selectedDeviceDetails!,
            builder: _buildDeviceDetailsTable,
          ),
        ] else if (_selectedDeviceId != null) ...[
          _buildNotFoundCard('Сонгосон төхөөрөмжийн мэдээлэл олдсонгүй'),
        ],
      ],
    );
  }

  /// Build model selection interface
  Widget _buildModelSelection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSelectionCard(
          title: 'Төхөөрөмжийн загвар сонгох:',
          hint: 'Загварын ID сонгоно уу',
          value: _selectedModelId,
          items: _deviceModels,
          onChanged: _onModelSelected,
          itemBuilder: _buildModelItem,
        ),
        const SizedBox(height: 16),
        if (_selectedModelDetails != null) ...[
          _buildDetailsCard(
            icon: Icons.category,
            title: 'Загварын дэлгэрэнгүй мэдээлэл',
            color: Colors.green,
            details: _selectedModelDetails!,
            builder: _buildModelDetailsTable,
          ),
        ] else if (_selectedModelId != null) ...[
          _buildNotFoundCard('Сонгосон загварын мэдээлэл олдсонгүй'),
        ],
      ],
    );
  }

  /// Build selection card
  Widget _buildSelectionCard({
    required String title,
    required String hint,
    required String? value,
    required List<dynamic> items,
    required ValueChanged<String?> onChanged,
    required Widget Function(Map<String, dynamic>) itemBuilder,
  }) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              value: value,
              hint: Text(hint),
              decoration: InputDecoration(
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
              ),
              items: items.map<DropdownMenuItem<String>>((item) {
                final itemMap = item as Map<String, dynamic>;
                final id = itemMap['id']?.toString() ?? '';
                return DropdownMenuItem<String>(
                  value: id,
                  child: itemBuilder(itemMap),
                );
              }).toList(),
              onChanged: onChanged,
            ),
          ],
        ),
      ),
    );
  }

  /// Build device dropdown item
  Widget _buildDeviceItem(Map<String, dynamic> device) {
    final id = device['id']?.toString() ?? '';
    final name = device['name']?.toString() ?? '';
    final displayText = name.isNotEmpty ? '$id - $name' : id;
    return Text(displayText);
  }

  /// Build model dropdown item
  Widget _buildModelItem(Map<String, dynamic> model) {
    final id = model['id']?.toString() ?? '';
    final name = model['name']?.toString() ?? model['model']?.toString() ?? '';
    final displayText = name.isNotEmpty ? '$id - $name' : id;
    return Text(displayText);
  }

  /// Build details card
  Widget _buildDetailsCard({
    required IconData icon,
    required String title,
    required Color color,
    required Map<String, dynamic> details,
    required Widget Function(Map<String, dynamic>) builder,
  }) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: color),
                const SizedBox(width: 8),
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: color,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            builder(details),
          ],
        ),
      ),
    );
  }

  /// Build not found card
  Widget _buildNotFoundCard(String message) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Text(message, style: const TextStyle(color: Colors.orange)),
      ),
    );
  }

  /// Build device details table
  Widget _buildDeviceDetailsTable(Map<String, dynamic> details) {
    final metadata = details['metadata'];

    if (metadata == null) {
      return _buildNotFoundCard(
        'Энэ төхөөрөмжид metadata мэдээлэл байхгүй байна.',
      );
    }

    final metadataMap = _parseMetadata(metadata);
    return _buildTable(metadataMap);
  }

  /// Build model details table
  Widget _buildModelDetailsTable(Map<String, dynamic> details) {
    final model = details['model'];

    if (model == null) {
      return _buildNotFoundCard('Энэ загварт model мэдээлэл байхгүй байна.');
    }

    return _buildTable({'Загвар': model.toString()});
  }

  /// Parse metadata from various formats
  Map<String, dynamic> _parseMetadata(dynamic metadata) {
    if (metadata is String) {
      try {
        return jsonDecode(metadata) as Map<String, dynamic>;
      } catch (e) {
        return {'Metadata': metadata.toString()};
      }
    } else if (metadata is Map<String, dynamic>) {
      return metadata;
    } else {
      return {'metadata': metadata.toString()};
    }
  }

  /// Build table widget
  Widget _buildTable(Map<String, dynamic> data) {
    return Table(
      columnWidths: const {0: FlexColumnWidth(1), 1: FlexColumnWidth(2)},
      border: TableBorder.all(color: Colors.grey[300]!, width: 1),
      children: data.entries.map((entry) {
        return TableRow(
          children: [
            Padding(
              padding: const EdgeInsets.all(12.0),
              child: Text(
                _getColumnDisplayName(entry.key),
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(12.0),
              child: Text(
                entry.value?.toString() ?? '',
                style: const TextStyle(fontSize: 14),
              ),
            ),
          ],
        );
      }).toList(),
    );
  }

  /// Get display name for column
  String _getColumnDisplayName(String key) {
    switch (key.toLowerCase()) {
      case 'firmware':
        return 'Firmware хувилбар';
      case 'location':
        return 'Байршил';
      case 'metadata':
        return 'Нэмэлт мэдээлэл';
      case 'model':
        return 'Загвар';
      default:
        return key.replaceAll('_', ' ').toUpperCase();
    }
  }
}
