import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:app/providers/inspection_provider.dart';
import 'package:app/assets/app_colors.dart';
import 'package:app/widgets/common/app_components.dart';
import 'package:app/pages/inspection_start_page.dart';
import 'package:app/widgets/assigned_list.dart'; // Import original AssignedItem

class AssignedList extends StatefulWidget {
  final String type; // inspection | repair | install
  const AssignedList({super.key, required this.type});

  @override
  State<AssignedList> createState() => _AssignedListState();
}

class _AssignedListState extends State<AssignedList> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadData();
    });
  }

  Future<void> _loadData() async {
    final inspectionProvider = Provider.of<InspectionProvider>(
      context,
      listen: false,
    );
    await inspectionProvider.refreshType(widget.type);
  }

  List<AssignedItem> _getItemsForType(InspectionProvider provider) {
    switch (widget.type.toLowerCase()) {
      case 'inspection':
        return provider.assignedInspections.map(_mapToAssignedItem).toList();
      case 'repair':
      case 'maintenance':
        return provider.assignedRepairs.map(_mapToAssignedItem).toList();
      case 'install':
      case 'installation':
        return provider.assignedInstallations.map(_mapToAssignedItem).toList();
      default:
        return [];
    }
  }

  AssignedItem _mapToAssignedItem(Map<String, dynamic> item) {
    return AssignedItem(
      id: item['id']?.toString() ?? '',
      title: item['title']?.toString() ?? 'Unknown',
      type: item['type']?.toString() ?? widget.type,
      contractName: item['contractName']?.toString(),
      deviceLocation: item['deviceLocation']?.toString(),
      deviceModel: item['deviceModel']?.toString(),
      deviceInfo: item['deviceInfo'],
      deviceModelInfo: item['deviceModelInfo'],
    );
  }

  bool _isLoadingForType(InspectionProvider provider) {
    switch (widget.type.toLowerCase()) {
      case 'inspection':
        return provider.isLoadingInspections;
      case 'repair':
      case 'maintenance':
        return provider.isLoadingRepairs;
      case 'install':
      case 'installation':
        return provider.isLoadingInstallations;
      default:
        return false;
    }
  }

  String? _getErrorForType(InspectionProvider provider) {
    switch (widget.type.toLowerCase()) {
      case 'inspection':
        return provider.inspectionsError;
      case 'repair':
      case 'maintenance':
        return provider.repairsError;
      case 'install':
      case 'installation':
        return provider.installationsError;
      default:
        return null;
    }
  }

  void _onTap(AssignedItem item) {
    if (item.type.toLowerCase() == 'inspection') {
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => InspectionStartPage(
            item: item,
            deviceInfo: item.deviceInfo,
            deviceModelInfo: item.deviceModelInfo,
          ),
        ),
      );
    } else {
      _showStartSheet(context, item);
    }
  }

  void _showStartSheet(BuildContext context, AssignedItem item) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _buildSimpleDeviceInfo(item),
              const SizedBox(height: 16),
              AppComponents.primaryButton(
                text: _actionVerb(item.type),
                onPressed: () {
                  Navigator.of(ctx).pop();
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('${_actionVerb(item.type)} эхэллээ'),
                    ),
                  );
                },
              ),
              const SizedBox(height: 8),
              AppComponents.secondaryButton(
                text: 'Болих',
                onPressed: () => Navigator.of(ctx).pop(),
              ),
            ],
          ),
        );
      },
    );
  }

  String _actionVerb(String type) {
    switch (type.toLowerCase()) {
      case 'repair':
        return 'Засварыг эхлүүлэх';
      case 'install':
      case 'installation':
        return 'Суурилуулалтыг эхлүүлэх';
      default:
        return 'Үзлэгийг эхлүүлэх';
    }
  }

  Widget _buildSimpleDeviceInfo(AssignedItem item) {
    String? deviceModel;
    String? location;

    if (item.deviceInfo != null) {
      if (item.deviceInfo!['model'] is Map<String, dynamic>) {
        final modelInfo = item.deviceInfo!['model'] as Map<String, dynamic>;
        deviceModel = modelInfo['model']?.toString();
      }

      final metadata = item.deviceInfo!['metadata'];
      if (metadata != null) {
        if (metadata is String) {
          try {
            final metadataMap = jsonDecode(metadata) as Map<String, dynamic>;
            location = metadataMap['location']?.toString();
          } catch (e) {
            // JSON parse error
          }
        } else if (metadata is Map<String, dynamic>) {
          location = metadata['location']?.toString();
        }
      }
    }

    if (deviceModel == null) deviceModel = item.deviceModel;
    if (location == null) location = item.deviceLocation;

    return Column(
      children: [
        if (deviceModel != null && deviceModel.isNotEmpty) ...[
          Text(
            deviceModel,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
        ],
        if (location != null && location.isNotEmpty) ...[
          Text(
            location,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: Colors.grey,
            ),
          ),
          const SizedBox(height: 8),
        ],
      ],
    );
  }

  String _buildSubtitle(AssignedItem item) {
    List<String> parts = [];

    if (item.deviceLocation != null && item.deviceLocation!.isNotEmpty) {
      parts.add(item.deviceLocation!);
    }

    if (item.deviceModel != null && item.deviceModel!.isNotEmpty) {
      parts.add(item.deviceModel!);
    }

    if (parts.isEmpty) {
      return '';
    }

    return parts.join(' • ');
  }

  String _emptyTextForType(String type) {
    switch (type.toLowerCase()) {
      case 'repair':
        return 'Одоогоор даалгасан засвар алга.';
      case 'install':
      case 'installation':
        return 'Одоогоор даалгасан суурилуулалт алга.';
      default:
        return 'Одоогоор даалгасан үзлэг алга.';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<InspectionProvider>(
      builder: (context, provider, child) {
        final items = _getItemsForType(provider);
        final isLoading = _isLoadingForType(provider);
        final error = _getErrorForType(provider);

        if (isLoading) {
          return AppComponents.loadingIndicator(message: 'Ачаалж байна...');
        }

        if (error != null) {
          return AppComponents.errorWidget(message: error, onRetry: _loadData);
        }

        if (items.isEmpty) {
          return AppComponents.emptyState(
            message: _emptyTextForType(widget.type),
            icon: Icons.assignment_outlined,
          );
        }

        return RefreshIndicator(
          onRefresh: _loadData,
          child: ListView.separated(
            padding: const EdgeInsets.all(16.0),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final item = items[index];
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
                              _buildSubtitle(item),
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
      },
    );
  }
}
