import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:app/widgets/assigned_list.dart';
import 'package:app/services/api.dart';

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

  // Selected items for dropdown
  String? _selectedDeviceId;
  String? _selectedModelId;
  Map<String, dynamic>? _selectedDeviceDetails;
  Map<String, dynamic>? _selectedModelDetails;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadDevices();
    _loadDeviceModels();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadDevices() async {
    try {
      setState(() {
        _isLoadingDevices = true;
        _devicesError = '';
      });

      final response = await InspectionAPI.getDevices();

      setState(() {
        if (response is Map<String, dynamic>) {
          final data =
              response['data'] ??
              response['items'] ??
              response['result'] ??
              response['devices'] ??
              response['rows'];

          if (data is List) {
            // Давхардсан ID-уудыг арилгах
            final uniqueDevices = <String, dynamic>{};
            for (final device in data) {
              if (device is Map<String, dynamic>) {
                final id = device['id']?.toString();
                if (id != null && id.isNotEmpty) {
                  uniqueDevices[id] = device;
                }
              }
            }

            _devices = uniqueDevices.values.toList();
          } else {
            _devices = [];
          }
        } else if (response is List) {
          _devices = response;
        } else {
          _devices = [];
        }
        _isLoadingDevices = false;
      });
    } catch (e) {
      debugPrint('Error loading devices: $e');
      setState(() {
        _devicesError = 'Төхөөрөмжийн мэдээлэл татахад алдаа гарлаа: $e';
        _isLoadingDevices = false;
        _devices = [];
      });
    }
  }

  Future<void> _loadDeviceModels() async {
    try {
      setState(() {
        _isLoadingModels = true;
        _modelsError = '';
      });

      final response = await InspectionAPI.getDeviceModels();

      setState(() {
        if (response is Map<String, dynamic>) {
          final data =
              response['data'] ??
              response['items'] ??
              response['result'] ??
              response['models'] ??
              response['deviceModels'] ??
              response['rows'];

          if (data is List) {
            _deviceModels = data;
          } else {
            _deviceModels = [];
          }
        } else if (response is List) {
          _deviceModels = response;
        } else {
          _deviceModels = [];
        }
        _isLoadingModels = false;
      });
    } catch (e) {
      debugPrint('Error loading device models: $e');
      setState(() {
        _modelsError =
            'Төхөөрөмжийн загварын мэдээлэл татахад алдаа гарлаа: $e';
        _isLoadingModels = false;
        _deviceModels = [];
      });
    }
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
          // Засварын жагсаалт
          const AssignedList(type: 'repair'),

          // Төхөөрөмжүүдийн хүснэгт
          _buildDevicesTable(),

          // Төхөөрөмжийн загваруудын хүснэгт
          _buildDeviceModelsTable(),
        ],
      ),
    );
  }

  Widget _buildDevicesTable() {
    if (_isLoadingDevices) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_devicesError.isNotEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 64, color: Colors.red[300]),
            const SizedBox(height: 16),
            Text(
              _devicesError,
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.red[600]),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _loadDevices,
              child: const Text('Дахин оролдох'),
            ),
          ],
        ),
      );
    }

    if (_devices.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.devices_other, size: 64, color: Colors.grey),
            SizedBox(height: 16),
            Text(
              'Төхөөрөмж олдсонгүй',
              style: TextStyle(fontSize: 18, color: Colors.grey),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadDevices,
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Dropdown for device selection
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Төхөөрөмж сонгох:',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      value: _selectedDeviceId,
                      hint: const Text('Төхөөрөмжийн ID сонгоно уу'),
                      decoration: InputDecoration(
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                      ),
                      items: _devices.map<DropdownMenuItem<String>>((device) {
                        final deviceMap = device as Map<String, dynamic>;
                        final id = deviceMap['id']?.toString() ?? '';
                        final name = deviceMap['name']?.toString() ?? '';
                        final displayText = name.isNotEmpty
                            ? '$id - $name'
                            : id;

                        return DropdownMenuItem<String>(
                          value: id,
                          child: Text(displayText),
                        );
                      }).toList(),
                      onChanged: (String? newValue) {
                        setState(() {
                          _selectedDeviceId = newValue;
                          _selectedDeviceDetails = newValue != null
                              ? _devices.firstWhere(
                                  (device) =>
                                      device['id'].toString() == newValue,
                                  orElse: () => null,
                                )
                              : null;
                        });
                      },
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 16),

            // Display selected device details
            if (_selectedDeviceDetails != null) ...[
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.info_outline, color: Colors.blue),
                          const SizedBox(width: 8),
                          Text(
                            'Төхөөрөмжийн дэлгэрэнгүй мэдээлэл',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: Colors.blue[700],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      _buildDeviceDetailsTable(_selectedDeviceDetails!),
                    ],
                  ),
                ),
              ),
            ] else if (_selectedDeviceId != null) ...[
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(16.0),
                  child: Text(
                    'Сонгосон төхөөрөмжийн мэдээлэл олдсонгүй',
                    style: TextStyle(color: Colors.orange),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildDeviceModelsTable() {
    if (_isLoadingModels) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_modelsError.isNotEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 64, color: Colors.red[300]),
            const SizedBox(height: 16),
            Text(
              _modelsError,
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.red[600]),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _loadDeviceModels,
              child: const Text('Дахин оролдох'),
            ),
          ],
        ),
      );
    }

    if (_deviceModels.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.category, size: 64, color: Colors.grey),
            SizedBox(height: 16),
            Text(
              'Төхөөрөмжийн загвар олдсонгүй',
              style: TextStyle(fontSize: 18, color: Colors.grey),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadDeviceModels,
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Dropdown for device model selection
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Төхөөрөмжийн загвар сонгох:',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      value: _selectedModelId,
                      hint: const Text('Загварын ID сонгоно уу'),
                      decoration: InputDecoration(
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                      ),
                      items: _deviceModels.map<DropdownMenuItem<String>>((
                        model,
                      ) {
                        final modelMap = model as Map<String, dynamic>;
                        final id = modelMap['id']?.toString() ?? '';
                        final name =
                            modelMap['name']?.toString() ??
                            modelMap['model']?.toString() ??
                            '';
                        final displayText = name.isNotEmpty
                            ? '$id - $name'
                            : id;

                        return DropdownMenuItem<String>(
                          value: id,
                          child: Text(displayText),
                        );
                      }).toList(),
                      onChanged: (String? newValue) {
                        setState(() {
                          _selectedModelId = newValue;
                          _selectedModelDetails = newValue != null
                              ? _deviceModels.firstWhere(
                                  (model) => model['id'].toString() == newValue,
                                  orElse: () => null,
                                )
                              : null;
                        });
                      },
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 16),

            // Display selected model details
            if (_selectedModelDetails != null) ...[
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.category, color: Colors.green),
                          const SizedBox(width: 8),
                          Text(
                            'Загварын дэлгэрэнгүй мэдээлэл',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: Colors.green[700],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      _buildModelDetailsTable(_selectedModelDetails!),
                    ],
                  ),
                ),
              ),
            ] else if (_selectedModelId != null) ...[
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(16.0),
                  child: Text(
                    'Сонгосон загварын мэдээлэл олдсонгүй',
                    style: TextStyle(color: Colors.orange),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildDeviceDetailsTable(Map<String, dynamic> details) {
    // Зөвхөн metadata field-ийг харуулах
    final metadata = details['metadata'];

    if (metadata == null) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(16.0),
          child: Text(
            'Энэ төхөөрөмжид metadata мэдээлэл байхгүй байна.',
            style: TextStyle(color: Colors.orange),
          ),
        ),
      );
    }

    // Metadata нь JSON string байж болно
    Map<String, dynamic> metadataMap;
    if (metadata is String) {
      try {
        metadataMap = jsonDecode(metadata) as Map<String, dynamic>;
      } catch (e) {
        // JSON parse хийх боломжгүй бол string-ээр харуулах
        return Table(
          columnWidths: const {0: FlexColumnWidth(1), 1: FlexColumnWidth(2)},
          border: TableBorder.all(color: Colors.grey[300]!, width: 1),
          children: [
            TableRow(
              children: [
                const Padding(
                  padding: EdgeInsets.all(12.0),
                  child: Text(
                    'Metadata',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(12.0),
                  child: Text(
                    metadata.toString(),
                    style: const TextStyle(fontSize: 14),
                  ),
                ),
              ],
            ),
          ],
        );
      }
    } else if (metadata is Map<String, dynamic>) {
      metadataMap = metadata;
    } else {
      metadataMap = {'metadata': metadata.toString()};
    }

    return Table(
      columnWidths: const {0: FlexColumnWidth(1), 1: FlexColumnWidth(2)},
      border: TableBorder.all(color: Colors.grey[300]!, width: 1),
      children: metadataMap.entries.map((entry) {
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

  Widget _buildModelDetailsTable(Map<String, dynamic> details) {
    // Зөвхөн model field-ийг харуулах
    final model = details['model'];

    if (model == null) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(16.0),
          child: Text(
            'Энэ загварт model мэдээлэл байхгүй байна.',
            style: TextStyle(color: Colors.orange),
          ),
        ),
      );
    }

    return Table(
      columnWidths: const {0: FlexColumnWidth(1), 1: FlexColumnWidth(2)},
      border: TableBorder.all(color: Colors.grey[300]!, width: 1),
      children: [
        TableRow(
          children: [
            const Padding(
              padding: EdgeInsets.all(12.0),
              child: Text(
                'Загвар',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(12.0),
              child: Text(
                model.toString(),
                style: const TextStyle(fontSize: 14),
              ),
            ),
          ],
        ),
      ],
    );
  }

  String _getColumnDisplayName(String key) {
    switch (key.toLowerCase()) {
      // Metadata fields
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
