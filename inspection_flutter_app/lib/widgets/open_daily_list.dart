import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:app/services/api.dart';
import 'package:app/assets/app_colors.dart';
import 'package:app/pages/inspection_start_page.dart';
import 'package:app/utils/api_response_parser.dart';
import 'package:app/widgets/assigned_list.dart';

class OpenDailyItem {
  final String id;
  final String title;
  final String? contractName;
  final String type;
  final String? deviceId;
  final String? deviceLocation;
  final String? deviceModel;
  final Map<String, dynamic>? deviceInfo;
  final Map<String, dynamic>? deviceModelInfo;

  const OpenDailyItem({
    required this.id,
    required this.title,
    required this.type,
    this.contractName,
    this.deviceId,
    this.deviceLocation,
    this.deviceModel,
    this.deviceInfo,
    this.deviceModelInfo,
  });
}

class OpenDailyList extends StatefulWidget {
  const OpenDailyList({super.key});

  @override
  State<OpenDailyList> createState() => _OpenDailyListState();
}

class _OpenDailyListState extends State<OpenDailyList> {
  bool _loading = true;
  String _error = '';
  List<OpenDailyItem> _items = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      debugPrint('=== LOADING OPEN DAILY INSPECTIONS ===');

      final dynamic response = await InspectionAPI.getOpenDailyInspections();
      debugPrint('API response: $response');

      final rawItems = ApiResponseParser.parseListResponse(response);
      final parsed = await _parseResponseWithDeviceInfo(rawItems);
      debugPrint('Parsed items count: ${parsed.length}');

      setState(() {
        _items = parsed;
      });
    } catch (e) {
      debugPrint('Error loading open daily inspections: $e');
      setState(() {
        _error = 'Ачаалах үед алдаа гарлаа: $e';
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  Future<List<OpenDailyItem>> _parseResponseWithDeviceInfo(
    List<dynamic> rawItems,
  ) async {
    final items = _parseResponse(rawItems);

    // Fetch device info for each item
    for (int i = 0; i < items.length; i++) {
      try {
        debugPrint('=== FETCHING DEVICE INFO ===');
        debugPrint('Inspection ID: ${items[i].id}');
        final deviceResponse = await InspectionAPI.getDeviceDetails(
          items[i].id,
        );
        debugPrint('Device info response: $deviceResponse');

        if (deviceResponse is Map<String, dynamic>) {
          debugPrint('Response is Map, checking data field...');
          final data = deviceResponse['data'];
          debugPrint('Data field: $data');

          if (data is Map<String, dynamic> && data['device'] is Map) {
            final device = data['device'] as Map<String, dynamic>;
            debugPrint('Device field: $device');

            String? deviceLocation;
            String? deviceModel;
            Map<String, dynamic>? deviceModelInfo;

            // Get location directly from device.location (new backend structure)
            deviceLocation = device['location']?.toString();
            debugPrint('Location from device: $deviceLocation');

            // Get model from model.model
            if (device['model'] is Map) {
              final model = device['model'] as Map<String, dynamic>;
              deviceModel = model['model']?.toString();
              deviceModelInfo = model;
              debugPrint('Model from model: $deviceModel');
            }

            // Update the item with device info
            items[i] = OpenDailyItem(
              id: items[i].id,
              title: items[i].title,
              type: items[i].type,
              contractName: items[i].contractName,
              deviceId: items[i].deviceId,
              deviceLocation: deviceLocation,
              deviceModel: deviceModel,
              deviceInfo: device,
              deviceModelInfo: deviceModelInfo,
            );

            debugPrint(
              'Updated item: ${items[i].deviceLocation}, ${items[i].deviceModel}',
            );
          }
        }
      } catch (e) {
        debugPrint('Error fetching device info for ${items[i].id}: $e');
      }
    }

    return items;
  }

  List<OpenDailyItem> _parseResponse(List<dynamic> listData) {
    if (listData.isEmpty) return const [];

    return listData
        .map((raw) {
          if (raw is Map<String, dynamic>) {
            final dynamic idRaw =
                raw['id'] ?? raw['_id'] ?? raw['inspectionId'] ?? raw['taskId'];
            final String id = idRaw?.toString() ?? '';
            final String title =
                (raw['title'] ??
                        raw['name'] ??
                        raw['inspectionTitle'] ??
                        'ID: $id')
                    .toString();
            final String? contractName =
                (raw['contractName'] ??
                        raw['contract_name'] ??
                        (raw['contract'] is Map
                            ? raw['contract']['contractName'] ??
                                raw['contract']['name']
                            : null))
                    ?.toString();
            final String type =
                (raw['type'] ?? raw['inspectionType'] ?? 'inspection')
                    .toString();

            final String? deviceId = (raw['deviceId'] ?? raw['device_id'])
                ?.toString();

            return OpenDailyItem(
              id: id,
              title: title,
              type: type,
              contractName: contractName,
              deviceId: deviceId,
              deviceLocation: null,
              deviceModel: null,
              deviceInfo: null,
              deviceModelInfo: null,
            );
          }
          final String id = raw.toString();
          return OpenDailyItem(
            id: id,
            title: 'ID: $id',
            type: 'inspection',
            deviceId: null,
            deviceInfo: null,
            deviceModelInfo: null,
          );
        })
        .where((e) => e.id.isNotEmpty)
        .toList();
  }

  void _onTap(OpenDailyItem item) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => InspectionStartPage(
          item: AssignedItem(
            id: item.id,
            title: item.title,
            type: item.type,
            contractName: item.contractName,
            deviceId: item.deviceId,
            deviceLocation: item.deviceLocation,
            deviceModel: item.deviceModel,
            deviceInfo: item.deviceInfo,
            deviceModelInfo: item.deviceModelInfo,
          ),
          deviceInfo: item.deviceInfo,
          deviceModelInfo: item.deviceModelInfo,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error.isNotEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              _error,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.redAccent),
            ),
            const SizedBox(height: 8),
            ElevatedButton(
              onPressed: _load,
              child: const Text('Дахин ачаалах'),
            ),
          ],
        ),
      );
    }

    if (_items.isEmpty) {
      return const Center(
        child: Text('Одоогоор нээлттэй өдөр тутмын үзлэг алга.'),
      );
    }

    return RefreshIndicator(
      onRefresh: () async {
        await _load();
      },
      child: ListView.separated(
        padding: const EdgeInsets.all(16.0),
        itemCount: _items.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (context, index) {
          final item = _items[index];
          return SizedBox(
            height: 72,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.surface,
                foregroundColor: AppColors.textPrimary,
                elevation: 1,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: const BorderSide(color: Color(0xFFE6E6E6)),
                ),
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 12,
                ),
              ),
              onPressed: () => _onTap(item),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: AppColors.centerGradient,
                    ),
                    child: const Icon(
                      Icons.assignment_turned_in_rounded,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          item.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          _buildSubtitleWithDeviceInfo(item),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Icon(
                    Icons.play_arrow_rounded,
                    color: AppColors.primary,
                    size: 28,
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  String _buildSubtitleWithDeviceInfo(OpenDailyItem item) {
    List<String> parts = [];

    if (item.deviceInfo != null) {
      String? deviceModel;
      if (item.deviceInfo!['model'] is Map<String, dynamic>) {
        final modelInfo = item.deviceInfo!['model'] as Map<String, dynamic>;
        deviceModel = modelInfo['model']?.toString();
      }

      final metadata = item.deviceInfo!['metadata'];
      String? location;

      if (metadata != null) {
        if (metadata is String) {
          try {
            final metadataMap = jsonDecode(metadata) as Map<String, dynamic>;
            location = metadataMap['location']?.toString();
          } catch (e) {
            debugPrint('JSON parse error for metadata: $e');
          }
        } else if (metadata is Map<String, dynamic>) {
          location = metadata['location']?.toString();
        }
      }

      if (deviceModel != null && deviceModel.isNotEmpty) {
        parts.add(deviceModel);
      }

      if (location != null && location.isNotEmpty) {
        parts.add(location);
      }
    }

    if (parts.isEmpty) {
      if (item.deviceLocation != null && item.deviceLocation!.isNotEmpty) {
        parts.add(item.deviceLocation!);
      }
      if (item.deviceModel != null && item.deviceModel!.isNotEmpty) {
        parts.add(item.deviceModel!);
      }
    }

    if (parts.isEmpty) {
      return '';
    }

    return parts.join(' • ');
  }
}

