import 'package:flutter/material.dart';
import 'package:app/services/api.dart';
import 'package:app/assets/app_colors.dart';
import 'package:app/pages/inspection_run_page.dart';

class AssignedItem {
  final String id;
  final String title;
  final String? contractName;
  final String type;

  const AssignedItem({
    required this.id,
    required this.title,
    required this.type,
    this.contractName,
  });
}

class AssignedList extends StatefulWidget {
  final String type; // inspection | repair | install
  const AssignedList({super.key, required this.type});

  @override
  State<AssignedList> createState() => _AssignedListState();
}

class _AssignedListState extends State<AssignedList> {
  bool _loading = true;
  String _error = '';
  List<AssignedItem> _items = const [];

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
      // Map frontend types to backend types
      String backendType = widget.type;
      switch (widget.type.toLowerCase()) {
        case 'repair':
          backendType = 'maintenance';
          break;
        case 'install':
          backendType = 'installation';
          break;
        default:
          backendType = widget.type;
      }

      final dynamic response = await InspectionAPI.getAssignedByType(
        backendType,
      );
      final parsed = _parseResponse(response, widget.type);
      setState(() {
        _items = parsed;
      });
    } catch (e) {
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

  List<AssignedItem> _parseResponse(dynamic response, String fallbackType) {
    dynamic listData;
    if (response is Map<String, dynamic>) {
      listData =
          response['data'] ??
          response['items'] ??
          response['result'] ??
          response['rows'];
    } else {
      listData = response;
    }

    if (listData is! List) return const [];

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
                            ? raw['contract']['name']
                            : null))
                    ?.toString();
            final String type =
                (raw['type'] ?? raw['inspectionType'] ?? fallbackType)
                    .toString();
            return AssignedItem(
              id: id,
              title: title,
              type: type,
              contractName: contractName,
            );
          }
          final String id = raw.toString();
          return AssignedItem(id: id, title: 'ID: $id', type: fallbackType);
        })
        .where((e) => e.id.isNotEmpty)
        .toList();
  }

  void _onTap(AssignedItem item) {
    _showStartSheet(context, item);
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
              Text(
                _sheetTitle(item.type),
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text('ID: ${item.id}', textAlign: TextAlign.center),
              if (item.contractName != null) ...[
                const SizedBox(height: 4),
                Text(
                  'Гэрээ: ${item.contractName}',
                  textAlign: TextAlign.center,
                ),
              ],
              const SizedBox(height: 16),
              SizedBox(
                height: 48,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.black,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  onPressed: () {
                    Navigator.of(ctx).pop();
                    if (item.type.toLowerCase() == 'inspection') {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) =>
                              InspectionRunPage(inspectionId: item.id),
                        ),
                      );
                    } else {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('${_actionVerb(item.type)} эхэллээ'),
                        ),
                      );
                    }
                  },
                  child: Text('${_actionVerb(item.type)}'),
                ),
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text('Болих'),
              ),
            ],
          ),
        );
      },
    );
  }

  String _sheetTitle(String type) {
    switch (type.toLowerCase()) {
      case 'repair':
        return 'Засварыг эхлүүлэх';
      case 'install':
      case 'installation':
        return 'Суурилуулалтыг эхлүүлэх';
      default:
        return 'Үзлэг эхлүүлэх';
    }
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
      return Center(child: Text(_emptyTextForType(widget.type)));
    }

    return RefreshIndicator(
      onRefresh: _load,
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
                          item.contractName ?? 'ID: ${item.id}',
                          maxLines: 1,
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
}
