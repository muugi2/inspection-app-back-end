import 'package:flutter/material.dart';
import 'package:app/assets/app_colors.dart';
import 'package:app/widgets/assigned_list.dart';
import 'package:app/pages/inspection_run_page.dart';
import 'package:app/services/api.dart';

class InspectionStartPage extends StatefulWidget {
  final AssignedItem item;
  final Map<String, dynamic>? deviceInfo;
  final Map<String, dynamic>? deviceModelInfo;

  const InspectionStartPage({
    super.key,
    required this.item,
    this.deviceInfo,
    this.deviceModelInfo,
  });

  @override
  State<InspectionStartPage> createState() => _InspectionStartPageState();
}

class _InspectionStartPageState extends State<InspectionStartPage> {
  // Device-based card logic
  List<Map<String, dynamic>> _availableDevices = const [];
  bool _loadingDevices = false;
  String _deviceError = '';

  @override
  void initState() {
    super.initState();
    _loadAvailableDevices();
  }

  // Device-уудыг татах логик
  Future<void> _loadAvailableDevices() async {
    setState(() {
      _loadingDevices = true;
      _deviceError = '';
    });

    try {
      debugPrint('=== LOADING AVAILABLE DEVICES ===');

      // Бүх device-уудыг татах
      final devicesResponse = await InspectionAPI.getDevices();
      debugPrint('Devices API Response: $devicesResponse');

      List<Map<String, dynamic>> devices = [];

      if (devicesResponse is Map<String, dynamic>) {
        final data =
            devicesResponse['data'] ??
            devicesResponse['items'] ??
            devicesResponse['result'] ??
            devicesResponse['devices'] ??
            devicesResponse['rows'];

        if (data is List) {
          devices = data.cast<Map<String, dynamic>>();
        }
      } else if (devicesResponse is List) {
        devices = devicesResponse.cast<Map<String, dynamic>>();
      }

      debugPrint('Found ${devices.length} total devices');

      // Эхний device-ийн бүтцийг шалгах
      if (devices.isNotEmpty) {
        final firstDevice = devices.first;
        debugPrint('=== FIRST DEVICE STRUCTURE ===');
        debugPrint('Device keys: ${firstDevice.keys.toList()}');
        debugPrint(
          'Has organization: ${firstDevice.containsKey('organization')}',
        );
        debugPrint('Has contract: ${firstDevice.containsKey('contract')}');
        if (firstDevice.containsKey('organization')) {
          debugPrint('Organization data: ${firstDevice['organization']}');
        }
        if (firstDevice.containsKey('contract')) {
          debugPrint('Contract data: ${firstDevice['contract']}');
        }
        debugPrint('Full device: $firstDevice');
        debugPrint('===============================');
      }

      // Тухайн inspection-д хамаарах device-ийг олох
      // widget.item.deviceId нь inspection-ий device ID
      final inspectionDeviceId = widget.item.deviceId?.toString();

      debugPrint('=== FILTERING FOR INSPECTION DEVICE ===');
      debugPrint('Inspection ID: ${widget.item.id}');
      debugPrint('Looking for Device ID: $inspectionDeviceId');

      final targetDevices = devices.where((device) {
        final deviceId = device['id']?.toString();
        return deviceId == inspectionDeviceId;
      }).toList();

      debugPrint('Found ${targetDevices.length} device(s) for inspection');
      for (final device in targetDevices) {
        debugPrint(
          'Target device: ID=${device['id']}, Keys: ${device.keys.toList()}',
        );
      }

      setState(() {
        _availableDevices = targetDevices;
        _loadingDevices = false;
      });
    } catch (e) {
      debugPrint('Error loading available devices: $e');
      setState(() {
        _deviceError = 'Төхөөрөмжийн мэдээлэл татахад алдаа гарлаа: $e';
        _loadingDevices = false;
        _availableDevices = [];
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        title: const Text('Бүртгэлтэй үзлэг'),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: _buildDeviceBasedUI(),
    );
  }

  // Device-based UI
  Widget _buildDeviceBasedUI() {
    if (_loadingDevices) {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 16),
            Text('Төхөөрөмжийн мэдээлэл ачаалж байна...'),
          ],
        ),
      );
    }

    if (_deviceError.isNotEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, size: 64, color: Colors.red[300]),
            const SizedBox(height: 16),
            Text(
              _deviceError,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.redAccent),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _loadAvailableDevices,
              child: const Text('Дахин ачаалах'),
            ),
          ],
        ),
      );
    }

    if (_availableDevices.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.devices_other, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text(
              'Төхөөрөмж олдсонгүй',
              style: TextStyle(fontSize: 18, color: Colors.grey[600]),
            ),
            const SizedBox(height: 8),
            Text(
              'Энэ үзлэгт хамаарах төхөөрөмж байхгүй байна',
              style: TextStyle(fontSize: 14, color: Colors.grey[500]),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _loadAvailableDevices,
              child: const Text('Дахин шалгах'),
            ),
          ],
        ),
      );
    }

    // Device card-уудыг харуулах
    return RefreshIndicator(
      onRefresh: _loadAvailableDevices,
      child: ListView.separated(
        padding: const EdgeInsets.all(16.0),
        itemCount: _availableDevices.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (context, index) {
          final device = _availableDevices[index];
          return _buildDeviceCard(device);
        },
      ),
    );
  }

  // Device card үүсгэх
  Widget _buildDeviceCard(Map<String, dynamic> device) {
    final deviceId = device['id']?.toString() ?? '';
    final serialNumber = device['serialNumber']?.toString() ?? '';

    // Device мэдээллээс title үүсгэх
    String title = 'Төхөөрөмж ID: $deviceId';

    // Model мэдээлэл байвал нэмэх
    if (device['model'] is Map<String, dynamic>) {
      final model = device['model'] as Map<String, dynamic>;
      final modelName = model['model']?.toString();
      if (modelName != null && modelName.isNotEmpty) {
        title = modelName;
      }
    }

    // Organization + Contract мэдээлэл
    String? organizationInfo;

    // Organization.name авах (organizations биш organization)
    String? organizationName;
    if (device['organization'] is Map<String, dynamic>) {
      final organization = device['organization'] as Map<String, dynamic>;
      organizationName = organization['name']?.toString();
    }

    // Contract.contractName авах (contracts биш contract, contract_name биш contractName)
    String? contractName;
    if (device['contract'] is Map<String, dynamic>) {
      final contract = device['contract'] as Map<String, dynamic>;
      contractName = contract['contractName']?.toString();
    }

    // Organization.name + Contract.contractName нэгтгэх
    List<String> infoParts = [];
    if (organizationName != null && organizationName.isNotEmpty) {
      infoParts.add(organizationName);
    }
    if (contractName != null && contractName.isNotEmpty) {
      infoParts.add(contractName);
    }

    if (infoParts.isNotEmpty) {
      organizationInfo = infoParts.join(' • ');
    }

    debugPrint(
      'Device ID: $deviceId, Serial: $serialNumber, Organization info: $organizationInfo (org: $organizationName, contract: $contractName)',
    );

    return Card(
      elevation: 3,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () {
          // Жинхэнэ inspection ID ашиглаж InspectionRunPage руу шилжих
          // widget.item.id нь inspection ID (AssignedList-аас ирсэн)
          debugPrint('=== NAVIGATING TO INSPECTION ===');
          debugPrint('Inspection ID: ${widget.item.id}');
          debugPrint('Device ID: $deviceId');
          debugPrint('Device Info: $device');

          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => InspectionRunPage(
                inspectionId: widget.item.id,
                deviceInfo: device, // Device мэдээллийг дамжуулах
              ),
            ),
          );
        },
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header with icon and title
              Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: AppColors.centerGradient,
                    ),
                    child: const Icon(
                      Icons.devices,
                      color: Colors.white,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: Colors.grey[800],
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Serial: $serialNumber',
                          style: TextStyle(
                            fontSize: 14,
                            color: Colors.grey[600],
                          ),
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    Icons.play_arrow_rounded,
                    color: AppColors.primary,
                    size: 32,
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // Organization + Contract мэдээлэл
              if (organizationInfo != null && organizationInfo.isNotEmpty) ...[
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.green[50],
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.green[200]!),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.business, color: Colors.green[600], size: 20),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          organizationInfo,
                          style: TextStyle(
                            fontSize: 14,
                            color: Colors.green[800],
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // Start inspection hint
              Container(
                padding: const EdgeInsets.symmetric(
                  vertical: 8,
                  horizontal: 12,
                ),
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.touch_app, size: 16, color: AppColors.primary),
                    const SizedBox(width: 6),
                    Text(
                      'Үзлэг эхлүүлэхийн тулд дарна уу',
                      style: TextStyle(
                        fontSize: 12,
                        color: AppColors.primary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
