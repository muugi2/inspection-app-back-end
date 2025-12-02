import 'package:flutter/material.dart';
import 'package:table_calendar/table_calendar.dart';
import 'package:app/assets/app_colors.dart';
import 'package:app/services/api.dart';
import 'package:app/utils/api_response_parser.dart';

class PlanPage extends StatefulWidget {
  const PlanPage({super.key});

  @override
  State<PlanPage> createState() => _PlanPageState();
}

class _PlanPageState extends State<PlanPage> {
  DateTime _selectedDay = DateTime.now();
  DateTime _focusedDay = DateTime.now();
  CalendarFormat _calendarFormat = CalendarFormat.month;
  Set<DateTime> _inspectionDates = {};
  List<Map<String, dynamic>> _allInspections = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadInspections();
  }

  Future<void> _loadInspections() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final response = await InspectionAPI.getAll();
      final rawItems = ApiResponseParser.parseListResponse(response);
      
      final Set<DateTime> dates = {};
      final List<Map<String, dynamic>> inspections = [];
      
      for (final item in rawItems) {
        if (item is Map<String, dynamic>) {
          // Зөвхөн дуусаагүй үзлэгүүдийг календар дээр харуулах
          final status = item['status']?.toString().toUpperCase();
          final completedStatuses = ['APPROVED', 'REJECTED', 'CANCELED'];
          final isCompleted = status != null && completedStatuses.contains(status);
          
          // Бүх үзлэгүүдийг жагсаалтад хадгална (сонгосон өдөрт харуулах)
          inspections.add(item);
          
          // Зөвхөн дуусаагүй үзлэгүүдийг календар дээр тэмдэглэх
          if (!isCompleted) {
            // scheduledAt огноо
            if (item['scheduledAt'] != null) {
              final scheduledAt = _parseDate(item['scheduledAt']);
              if (scheduledAt != null) {
                dates.add(scheduledAt);
              }
            }
            
            // startedAt огноо
            if (item['startedAt'] != null) {
              final startedAt = _parseDate(item['startedAt']);
              if (startedAt != null) {
                dates.add(startedAt);
              }
            }
          }
        }
      }

      setState(() {
        _inspectionDates = dates;
        _allInspections = inspections;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Үзлэгийн мэдээлэл ачаалахад алдаа гарлаа: $e';
        _isLoading = false;
      });
    }
  }

  DateTime? _parseDate(dynamic dateValue) {
    if (dateValue == null) return null;
    
    try {
      if (dateValue is String) {
        return DateTime.parse(dateValue);
      } else if (dateValue is DateTime) {
        return dateValue;
      } else if (dateValue is int) {
        // Unix timestamp
        return DateTime.fromMillisecondsSinceEpoch(dateValue);
      }
    } catch (e) {
      debugPrint('Date parse error: $e');
    }
    
    return null;
  }

  bool _isSameDay(DateTime? a, DateTime? b) {
    if (a == null || b == null) return false;
    return a.year == b.year && a.month == b.month && a.day == b.day;
  }

  List<DateTime> _getEventsForDay(DateTime day) {
    return _inspectionDates.where((date) => _isSameDay(date, day)).toList();
  }

  List<Map<String, dynamic>> _getInspectionsForDay(DateTime day) {
    return _allInspections.where((inspection) {
      // scheduledAt шалгах
      if (inspection['scheduledAt'] != null) {
        final scheduledAt = _parseDate(inspection['scheduledAt']);
        if (scheduledAt != null && _isSameDay(scheduledAt, day)) {
          return true;
        }
      }
      
      // startedAt шалгах
      if (inspection['startedAt'] != null) {
        final startedAt = _parseDate(inspection['startedAt']);
        if (startedAt != null && _isSameDay(startedAt, day)) {
          return true;
        }
      }
      
      // completedAt шалгах
      if (inspection['completedAt'] != null) {
        final completedAt = _parseDate(inspection['completedAt']);
        if (completedAt != null && _isSameDay(completedAt, day)) {
          return true;
        }
      }
      
      return false;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final selectedDayInspections = _getInspectionsForDay(_selectedDay);
    
    return Padding(
      padding: const EdgeInsets.fromLTRB(16.0, 16.0, 16.0, 100.0), // Navbar-ийн өргөлтийн хувьд bottom padding
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Card(
            color: AppColors.surface,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            child: Padding(
              padding: const EdgeInsets.all(8.0),
              child: _isLoading
                  ? const Center(
                      child: Padding(
                        padding: EdgeInsets.all(32.0),
                        child: CircularProgressIndicator(),
                      ),
                    )
                  : _error != null
                      ? Padding(
                          padding: const EdgeInsets.all(16.0),
                          child: Column(
                            children: [
                              Text(
                                _error!,
                                style: const TextStyle(color: Colors.red),
                                textAlign: TextAlign.center,
                              ),
                              const SizedBox(height: 8),
                              ElevatedButton(
                                onPressed: _loadInspections,
                                child: const Text('Дахин ачаалах'),
                              ),
                            ],
                          ),
                        )
                      : TableCalendar(
                          firstDay: DateTime.utc(DateTime.now().year - 2, 1, 1),
                          lastDay: DateTime.utc(DateTime.now().year + 2, 12, 31),
                          focusedDay: _focusedDay,
                          selectedDayPredicate: (day) => _isSameDay(_selectedDay, day),
                          calendarFormat: _calendarFormat,
                          eventLoader: _getEventsForDay,
                          startingDayOfWeek: StartingDayOfWeek.monday,
                          calendarStyle: CalendarStyle(
                            outsideDaysVisible: false,
                            weekendTextStyle: const TextStyle(color: Colors.red),
                            selectedDecoration: BoxDecoration(
                              color: AppColors.primary,
                              shape: BoxShape.circle,
                            ),
                            todayDecoration: BoxDecoration(
                              color: const Color(0xFFFF8C00).withValues(alpha: 0.5),
                              shape: BoxShape.circle,
                            ),
                            markerDecoration: BoxDecoration(
                              color: AppColors.secondary,
                              shape: BoxShape.circle,
                            ),
                            markerSize: 6,
                            markersMaxCount: 1,
                          ),
                          headerStyle: HeaderStyle(
                            formatButtonVisible: true,
                            titleCentered: true,
                            formatButtonShowsNext: false,
                            formatButtonDecoration: BoxDecoration(
                              color: AppColors.primary,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            formatButtonTextStyle: const TextStyle(
                              color: Colors.white,
                              fontSize: 12,
                            ),
                          ),
                          onDaySelected: (selectedDay, focusedDay) {
                            setState(() {
                              _selectedDay = selectedDay;
                              _focusedDay = focusedDay;
                            });
                          },
                          onFormatChanged: (format) {
                            setState(() {
                              _calendarFormat = format;
                            });
                          },
                          onPageChanged: (focusedDay) {
                            setState(() {
                              _focusedDay = focusedDay;
                            });
                          },
                        ),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Сонгосон огноо: ${_selectedDay.year}-${_selectedDay.month.toString().padLeft(2, '0')}-${_selectedDay.day.toString().padLeft(2, '0')}',
            style: const TextStyle(fontWeight: FontWeight.w600),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          // Үзлэгийн жагсаалт
          if (selectedDayInspections.isNotEmpty) ...[
            Text(
              'Үзлэг (${selectedDayInspections.length})',
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: ListView.separated(
                itemCount: selectedDayInspections.length,
                separatorBuilder: (context, index) => const SizedBox(height: 8),
                itemBuilder: (context, index) {
                  final inspection = selectedDayInspections[index];
                  return _buildInspectionCard(inspection);
                },
              ),
            ),
          ] else if (!_isLoading && _error == null) ...[
            Center(
              child: Padding(
                padding: const EdgeInsets.all(32.0),
                child: Text(
                  'Энэ өдөр үзлэг байхгүй',
                  style: TextStyle(
                    fontSize: 14,
                    color: AppColors.textSecondary,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildInspectionCard(Map<String, dynamic> inspection) {
    final String title = inspection['title']?.toString() ?? 'Үзлэг';
    final String? type = inspection['type']?.toString();
    final String? status = inspection['status']?.toString();
    final String? contractName = inspection['contractName']?.toString() ??
        (inspection['contract'] is Map
            ? inspection['contract']['contractName']?.toString()
            : null);
    
    // Device мэдээлэл
    String? deviceInfo;
    if (inspection['device'] is Map) {
      final device = inspection['device'] as Map<String, dynamic>;
      final serialNumber = device['serialNumber']?.toString();
      final assetTag = device['assetTag']?.toString();
      if (serialNumber != null || assetTag != null) {
        deviceInfo = [serialNumber, assetTag].where((e) => e != null).join(' • ');
      }
    }
    
    // Огноо мэдээлэл
    String? dateInfo;
    if (inspection['scheduledAt'] != null) {
      final scheduledAt = _parseDate(inspection['scheduledAt']);
      if (scheduledAt != null) {
        dateInfo = 'Төлөвлөсөн: ${_formatDate(scheduledAt)}';
      }
    } else if (inspection['startedAt'] != null) {
      final startedAt = _parseDate(inspection['startedAt']);
      if (startedAt != null) {
        dateInfo = 'Эхэлсэн: ${_formatDate(startedAt)}';
      }
    } else if (inspection['completedAt'] != null) {
      final completedAt = _parseDate(inspection['completedAt']);
      if (completedAt != null) {
        dateInfo = 'Дууссан: ${_formatDate(completedAt)}';
      }
    }

    return Card(
      color: AppColors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: Color(0xFFE6E6E6)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
                if (status != null)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: _getStatusColor(status),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      status,
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                      ),
                    ),
                  ),
              ],
            ),
            if (type != null) ...[
              const SizedBox(height: 4),
              Text(
                'Төрөл: $type',
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
            if (contractName != null) ...[
              const SizedBox(height: 4),
              Text(
                'Гэрээ: $contractName',
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
            if (deviceInfo != null) ...[
              const SizedBox(height: 4),
              Text(
                'Төхөөрөмж: $deviceInfo',
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
            if (dateInfo != null) ...[
              const SizedBox(height: 4),
              Text(
                dateInfo,
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _formatDate(DateTime date) {
    return '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
  }

  Color _getStatusColor(String status) {
    switch (status.toUpperCase()) {
      case 'COMPLETED':
      case 'ДУУССАН':
        return Colors.green;
      case 'IN_PROGRESS':
      case 'ЯВЖ БАЙНА':
        return Colors.blue;
      case 'PENDING':
      case 'ХҮЛЭЭГДЭЖ БАЙНА':
        return Colors.orange;
      case 'CANCELLED':
      case 'ЦУЦЛАГДСАН':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }
}
