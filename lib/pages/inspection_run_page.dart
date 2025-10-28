import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:app/services/api.dart';
import 'package:app/services/answer_service.dart';
import 'package:app/assets/app_colors.dart';
import 'package:app/pages/conclusion_page.dart';
import 'package:image_picker/image_picker.dart';

class InspectionRunPage extends StatefulWidget {
  final String inspectionId;
  final Map<String, dynamic>? deviceInfo; // Device мэдээлэл дамжуулах

  const InspectionRunPage({
    super.key,
    required this.inspectionId,
    this.deviceInfo,
  });

  @override
  State<InspectionRunPage> createState() => _InspectionRunPageState();
}

class _InspectionRunPageState extends State<InspectionRunPage> {
  // ===== LOADING & ERROR STATES =====
  bool _loading = true;
  String _error = '';

  // ===== TEMPLATE & SECTIONS =====
  Map<String, dynamic>?
  _template; // expecting { name, questions: [{title, fields:[...]}, ...] }
  List<Map<String, dynamic>> _sections = const [];

  // ===== PAGINATION & NAVIGATION =====
  int _currentSection = 0;
  final ScrollController _scrollController = ScrollController();

  // ===== UI STATES =====
  bool _showVerification = false;
  bool _showSectionReview = false;
  Map<String, dynamic>? _currentSectionAnswers;
  String? _answerId; // backend-ээс ирсэн answerId-г хадгална

  // ===== DEVICE INFO =====
  Map<String, dynamic>? _deviceInfo; // Device мэдээлэл (JSON payload-д ашиглах)

  // ===== FORM DATA =====
  final Map<String, Set<int>> _selectedOptionsByField = {}; // option indices
  final Map<String, String> _fieldTextByKey = {}; // extra text if required
  final Map<String, bool> _fieldHasImageByKey = {}; // image flag if required
  final Map<String, List<File>> _fieldImagesByKey = {}; // files per field

  // ===== LIFECYCLE METHODS =====
  @override
  void initState() {
    super.initState();
    _loadTemplate();

    // Constructor-аас ирсэн device мэдээлэл байвал ашиглах, үгүй бол API-аас татах
    if (widget.deviceInfo != null) {
      setState(() {
        _deviceInfo = widget.deviceInfo;
      });
      debugPrint('✅ Using device info from constructor: ${widget.deviceInfo}');
    } else {
      _loadDeviceInfo();
    }
  }

  // ===== DATA LOADING METHODS =====
  Future<void> _loadTemplate() async {
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final dynamic resp = await TemplateAPI.getTemplates(
        type: 'INSPECTION',
        isActive: true,
      );
      // Support both list and object shapes. If list, pick the first active template.
      Map<String, dynamic>? tpl;
      if (resp is Map<String, dynamic>) {
        final dynamic data =
            resp['data'] ?? resp['result'] ?? resp['items'] ?? resp;
        if (data is List && data.isNotEmpty) {
          tpl = (data.first is Map<String, dynamic>)
              ? data.first as Map<String, dynamic>
              : null;
        } else if (data is Map<String, dynamic>) {
          tpl = data;
        }
      } else if (resp is List && resp.isNotEmpty) {
        tpl = (resp.first is Map<String, dynamic>)
            ? resp.first as Map<String, dynamic>
            : null;
      }
      final parsedSections = _extractSections(tpl);
      setState(() {
        _template = tpl;
        _sections = parsedSections;
        _currentSection = 0;
        _selectedOptionsByField.clear();
        _fieldTextByKey.clear();
        _fieldHasImageByKey.clear();
      });
    } catch (e) {
      setState(() {
        _error = 'Template ачаалах үед алдаа гарлаа: $e';
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  // Device мэдээлэл татах
  Future<void> _loadDeviceInfo() async {
    try {
      debugPrint('=== LOADING DEVICE INFO FOR INSPECTION ===');
      debugPrint('Inspection ID: ${widget.inspectionId}');

      // Device-уудыг татаж, inspection ID-тай тохирох device олох
      final devicesResponse = await InspectionAPI.getDevices();

      if (devicesResponse is Map<String, dynamic>) {
        final data =
            devicesResponse['data'] ??
            devicesResponse['items'] ??
            devicesResponse['result'] ??
            devicesResponse['devices'] ??
            devicesResponse['rows'];

        if (data is List) {
          // Inspection ID-тай тохирох device олох
          for (final device in data) {
            if (device is Map<String, dynamic>) {
              final deviceId = device['id']?.toString();
              if (deviceId == widget.inspectionId) {
                setState(() {
                  _deviceInfo = device;
                });
                debugPrint('✅ Found device for inspection: $device');
                break;
              }
            }
          }
        }
      }

      if (_deviceInfo == null) {
        debugPrint(
          '⚠️ No device found for inspection ID: ${widget.inspectionId}',
        );
      }
    } catch (e) {
      debugPrint('❌ Error loading device info: $e');
    }
  }

  // ===== TEMPLATE PROCESSING METHODS =====
  List<Map<String, dynamic>> _extractSections(Map<String, dynamic>? tpl) {
    if (tpl == null) return const [];
    final dynamic rawSections = tpl['questions'];
    if (rawSections is! List) return const [];

    debugPrint('Raw sections count: ${rawSections.length}');

    return rawSections.map<Map<String, dynamic>>((sec) {
      if (sec is Map<String, dynamic>) {
        final String secTitle = (sec['title'] ?? '').toString();
        final String secSection = (sec['section'] ?? '').toString();
        final List<dynamic> fields = (sec['fields'] ?? []) as List<dynamic>;

        debugPrint(
          'Section: $secSection, Title: $secTitle, Fields count: ${fields.length}',
        );

        final List<Map<String, dynamic>>
        normalizedFields = fields.map<Map<String, dynamic>>((f) {
          if (f is Map<String, dynamic>) {
            final String qText = (f['question'] ?? f['title'] ?? '').toString();
            final List<dynamic> optionsDyn =
                (f['options'] ?? []) as List<dynamic>;
            final List<String> options = optionsDyn
                .map((e) => e.toString())
                .toList();
            final bool textRequired = (f['text_required'] ?? false) == true;
            final bool imageRequired = (f['image_required'] ?? false) == true;
            final String fieldId = (f['id'] ?? '').toString();
            return {
              'id': fieldId,
              'question': qText,
              'options': options,
              'text_required': textRequired,
              'image_required': imageRequired,
            };
          }
          return {
            'id': '',
            'question': f.toString(),
            'options': <String>[],
            'text_required': false,
            'image_required': false,
          };
        }).toList();
        return {
          'section': secSection,
          'title': secTitle,
          'fields': normalizedFields,
        };
      }
      return {
        'section': '',
        'title': sec.toString(),
        'fields': <Map<String, dynamic>>[],
      };
    }).toList();
  }

  // ===== UTILITY METHODS =====
  String _fieldKey(int sIdx, int fIdx) => '$sIdx|$fIdx';

  // ===== FORM HANDLING METHODS =====
  void _setSingleSelection(int sIdx, int fIdx, int optIdx) {
    final key = _fieldKey(sIdx, fIdx);
    setState(() {
      _selectedOptionsByField[key] = {optIdx};
    });
  }

  void _setFieldText(int sIdx, int fIdx, String text) {
    setState(() {
      _fieldTextByKey[_fieldKey(sIdx, fIdx)] = text;
    });
  }

  // ===== IMAGE HANDLING METHODS =====
  Future<void> _pickImageSource(int sIdx, int fIdx) async {
    final ImagePicker picker = ImagePicker();
    final XFile? picked = await showModalBottomSheet<XFile?>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.photo_camera_outlined),
                title: const Text('Камер'),
                onTap: () async {
                  final XFile? x = await picker.pickImage(
                    source: ImageSource.camera,
                    imageQuality: 85,
                  );
                  Navigator.of(ctx).pop(x);
                },
              ),
              ListTile(
                leading: const Icon(Icons.photo_library_outlined),
                title: const Text('Зургийн сан'),
                onTap: () async {
                  final XFile? x = await picker.pickImage(
                    source: ImageSource.gallery,
                    imageQuality: 85,
                  );
                  Navigator.of(ctx).pop(x);
                },
              ),
            ],
          ),
        );
      },
    );

    if (picked == null) return;
    final file = File(picked.path);
    final key = _fieldKey(sIdx, fIdx);
    setState(() {
      final list = _fieldImagesByKey[key] ?? <File>[];
      list.add(file);
      _fieldImagesByKey[key] = list;
      _fieldHasImageByKey[key] = true;
    });
  }

  void _removeImage(int sIdx, int fIdx, File file) {
    final key = _fieldKey(sIdx, fIdx);
    setState(() {
      final list = _fieldImagesByKey[key] ?? <File>[];
      list.remove(file);
      _fieldImagesByKey[key] = list;
      if (list.isEmpty) _fieldHasImageByKey[key] = false;
    });
  }

  // ===== UI BUILD METHODS =====
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Үзлэг эхлүүлэх'),
        bottom: _buildDeviceInfoHeader(),
      ),
      body: _buildBody(),
    );
  }

  PreferredSizeWidget? _buildDeviceInfoHeader() {
    // Device мэдээлэл харуулах header
    return PreferredSize(
      preferredSize: const Size.fromHeight(60),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.blue.withOpacity(0.1),
          border: Border(
            bottom: BorderSide(color: Colors.blue.withOpacity(0.3)),
          ),
        ),
        child: FutureBuilder<Map<String, dynamic>?>(
          future: _getDeviceInfoForHeader(),
          builder: (context, snapshot) {
            if (snapshot.hasData && snapshot.data != null) {
              final deviceInfo = snapshot.data!;
              String deviceText = '';

              // Model мэдээлэл
              if (deviceInfo['model'] is Map<String, dynamic>) {
                final model =
                    (deviceInfo['model'] as Map<String, dynamic>)['model']
                        ?.toString();
                if (model != null) deviceText += model;
              }

              // Location мэдээлэл
              final metadata = deviceInfo['metadata'];
              if (metadata != null) {
                String? location;
                if (metadata is String) {
                  try {
                    final metadataMap =
                        jsonDecode(metadata) as Map<String, dynamic>;
                    location = metadataMap['location']?.toString();
                  } catch (e) {
                    // Ignore parse error
                  }
                } else if (metadata is Map<String, dynamic>) {
                  location = metadata['location']?.toString();
                }

                if (location != null && location.isNotEmpty) {
                  if (deviceText.isNotEmpty) deviceText += ' • ';
                  deviceText += location;
                }
              }

              return Row(
                children: [
                  Icon(Icons.devices, color: Colors.blue[700], size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      deviceText.isNotEmpty
                          ? deviceText
                          : 'Төхөөрөмжийн мэдээлэл',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: Colors.blue[700],
                      ),
                    ),
                  ),
                ],
              );
            }

            return Row(
              children: [
                Icon(Icons.devices, color: Colors.grey[600], size: 20),
                const SizedBox(width: 8),
                Text(
                  'Төхөөрөмжийн мэдээлэл ачаалж байна...',
                  style: TextStyle(fontSize: 14, color: Colors.grey[600]),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Future<Map<String, dynamic>?> _getDeviceInfoForHeader() async {
    try {
      final devicesResponse = await InspectionAPI.getDevices();

      if (devicesResponse is Map<String, dynamic>) {
        final data =
            devicesResponse['data'] ??
            devicesResponse['items'] ??
            devicesResponse['result'] ??
            devicesResponse['devices'] ??
            devicesResponse['rows'];

        if (data is List) {
          for (final device in data) {
            if (device is Map<String, dynamic>) {
              final deviceId = device['id']?.toString();
              if (deviceId == '4' || deviceId == '5' || deviceId == '1') {
                return device;
              }
            }
          }
        }
      } else if (devicesResponse is List) {
        for (final device in devicesResponse) {
          if (device is Map<String, dynamic>) {
            final deviceId = device['id']?.toString();
            if (deviceId == '4' || deviceId == '5' || deviceId == '1') {
              return device;
            }
          }
        }
      }
    } catch (e) {
      debugPrint('Error getting device info for header: $e');
    }

    return null;
  }

  Widget _buildBody() {
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
              onPressed: _loadTemplate,
              child: const Text('Дахин ачаалах'),
            ),
          ],
        ),
      );
    }
    if (_template == null || _sections.isEmpty) {
      return const Center(child: Text('Идэвхтэй INSPECTION загвар олдсонгүй.'));
    }

    // Show verification screen if all sections are completed
    debugPrint(
      '_showVerification: $_showVerification, _showSectionReview: $_showSectionReview, _totalSections: $_totalSections, _currentSection: $_currentSection',
    );
    if (_showVerification) {
      debugPrint('Showing verification screen');
      return _buildVerificationScreen();
    }

    // Dynamic section bounds checking
    if (_currentSection >= _totalSections) {
      debugPrint('All sections completed, showing verification screen');
      setState(() {
        _showVerification = true;
      });
      return _buildVerificationScreen();
    }

    // Show section review if current section is completed
    if (_showSectionReview && _currentSectionAnswers != null) {
      debugPrint('Showing section review');
      return _buildSectionReviewScreen();
    }

    final String name = (_template!['name'] ?? 'INSPECTION').toString();
    final Map<String, dynamic> section = _sections[_currentSection];
    final String sectionTitle = (section['title'] ?? '').toString();
    final String sectionName = (section['section'] ?? '').toString();
    final List<dynamic> fields = (section['fields'] as List<dynamic>);

    debugPrint('Current section: $_currentSection/$_totalSections');
    debugPrint('Section name: $sectionName, Title: $sectionTitle');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Text(
            name,
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
          ),
        ),
        // Section progress indicator
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
          child: Row(
            children: [
              Text(
                'Хэсэг ${_currentSection + 1}/$_totalSections',
                style: const TextStyle(fontSize: 14, color: Colors.grey),
              ),
              const Spacer(),
              Text(
                '${((_currentSection + 1) / _totalSections * 100).round()}%',
                style: const TextStyle(fontSize: 14, color: Colors.grey),
              ),
            ],
          ),
        ),
        if (sectionTitle.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Text(
              sectionTitle,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
          ),
        const Divider(height: 1),
        Expanded(
          child: ListView.builder(
            controller: _scrollController,
            padding: const EdgeInsets.all(16.0),
            itemCount: fields.length,
            itemBuilder: (context, fIdx) {
              final Map<String, dynamic> field =
                  fields[fIdx] as Map<String, dynamic>;
              final String qText = (field['question'] ?? '').toString();
              final List<dynamic> options = (field['options'] as List<dynamic>);
              final String fKey = _fieldKey(_currentSection, fIdx);
              final Set<int> selected =
                  _selectedOptionsByField[fKey] ?? <int>{};
              final String textValue = _fieldTextByKey[fKey] ?? '';
              return Padding(
                padding: const EdgeInsets.only(bottom: 12.0),
                child: Card(
                  color: AppColors.surface,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(12.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          qText,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 8),
                        for (int oIdx = 0; oIdx < options.length; oIdx++)
                          RadioListTile<int>(
                            value: oIdx,
                            groupValue: selected.isEmpty
                                ? null
                                : selected.first,
                            onChanged: (val) {
                              if (val == null) return;
                              _setSingleSelection(_currentSection, fIdx, val);
                            },
                            title: Text(options[oIdx].toString()),
                            contentPadding: EdgeInsets.zero,
                          ),
                        // Show text field if answer is not "Зүгээр" or "Цэвэр"
                        if (_shouldShowTextField(selected, options))
                          Padding(
                            padding: const EdgeInsets.only(top: 8.0),
                            child: TextField(
                              decoration: const InputDecoration(
                                labelText: 'Тайлбар',
                                border: OutlineInputBorder(),
                              ),
                              onChanged: (v) =>
                                  _setFieldText(_currentSection, fIdx, v),
                              controller: TextEditingController.fromValue(
                                TextEditingValue(
                                  text: textValue,
                                  selection: TextSelection.collapsed(
                                    offset: textValue.length,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        // Show image field if answer is not "Зүгээр" or "Цэвэр"
                        if (_shouldShowImageField(selected, options))
                          Padding(
                            padding: const EdgeInsets.only(top: 8.0),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Wrap(
                                  spacing: 8,
                                  runSpacing: 8,
                                  children: [
                                    for (final file
                                        in _fieldImagesByKey[fKey] ??
                                            const <File>[])
                                      Stack(
                                        children: [
                                          ClipRRect(
                                            borderRadius: BorderRadius.circular(
                                              8,
                                            ),
                                            child: Image.file(
                                              file,
                                              width: 72,
                                              height: 72,
                                              fit: BoxFit.cover,
                                            ),
                                          ),
                                          Positioned(
                                            right: 0,
                                            top: 0,
                                            child: InkWell(
                                              onTap: () => _removeImage(
                                                _currentSection,
                                                fIdx,
                                                file,
                                              ),
                                              child: Container(
                                                decoration: BoxDecoration(
                                                  color: Colors.black54,
                                                  borderRadius:
                                                      BorderRadius.circular(10),
                                                ),
                                                padding: const EdgeInsets.all(
                                                  2,
                                                ),
                                                child: const Icon(
                                                  Icons.close,
                                                  size: 14,
                                                  color: Colors.white,
                                                ),
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                OutlinedButton.icon(
                                  onPressed: () =>
                                      _pickImageSource(_currentSection, fIdx),
                                  icon: const Icon(Icons.add_a_photo_outlined),
                                  label: const Text('Зураг оруулах'),
                                ),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 46),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _currentSection == 0
                      ? null
                      : () => setState(() => _currentSection -= 1),
                  child: const Text('Өмнөх'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: () async {
                    if (!_validateSection(_currentSection)) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Шаардлагатай талбаруудыг бөглөнө үү'),
                        ),
                      );
                      return;
                    }

                    // Show section review (backend submission will happen in review screen)
                    _displaySectionReview();
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.black,
                  ),
                  child: Text(
                    _currentSection >= (_totalSections - 1)
                        ? 'Дуусгах'
                        : 'Дараах',
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  int get _totalSections => _sections.length;

  // ===== DYNAMIC FIELD DISPLAY METHODS =====

  /// Check if text field should be shown based on selected answer
  bool _shouldShowTextField(Set<int> selected, List<dynamic> options) {
    if (selected.isEmpty) return false;

    final selectedOption = options[selected.first].toString();
    // Show text field if answer is NOT "Зүгээр", "Цэвэр", "Бүтэн", or "Саадгүй"
    return !selectedOption.contains('Зүгээр') &&
        !selectedOption.contains('Цэвэр') &&
        !selectedOption.contains('Бүтэн') &&
        !selectedOption.contains('Саадгүй');
  }

  /// Check if image field should be shown based on selected answer
  bool _shouldShowImageField(Set<int> selected, List<dynamic> options) {
    if (selected.isEmpty) return false;

    final selectedOption = options[selected.first].toString();
    // Show image field if answer is NOT "Зүгээр", "Цэвэр", "Бүтэн", or "Саадгүй"
    return !selectedOption.contains('Зүгээр') &&
        !selectedOption.contains('Цэвэр') &&
        !selectedOption.contains('Бүтэн') &&
        !selectedOption.contains('Саадгүй');
  }

  // ===== VALIDATION METHODS =====
  bool _validateSection(int sIdx) {
    final section = _sections[sIdx];
    final fields = (section['fields'] as List<dynamic>);
    for (int f = 0; f < fields.length; f++) {
      final field = fields[f] as Map<String, dynamic>;
      final String key = _fieldKey(sIdx, f);
      final List<dynamic> options = (field['options'] as List<dynamic>);
      final selected = _selectedOptionsByField[key] ?? <int>{};

      if (selected.isEmpty) return false;

      // Check if text is required based on selected answer
      if (_shouldShowTextField(selected, options)) {
        final txt = (_fieldTextByKey[key] ?? '').trim();
        if (txt.isEmpty) return false;
      }

      // Check if image is required based on selected answer
      if (_shouldShowImageField(selected, options)) {
        final imgs = _fieldImagesByKey[key] ?? const <File>[];
        if (imgs.isEmpty) return false;
      }
    }
    return true;
  }

  // ===== SECTION MANAGEMENT METHODS =====

  // Navigation methods

  void _onFinish() {
    debugPrint('=== _onFinish() called ===');

    if (_currentSection >= (_totalSections - 1)) {
      // Last section - show verification screen
      setState(() {
        _showVerification = true;
      });
    } else {
      // Move to next section
      setState(() {
        _currentSection++;
      });
    }
  }

  void _displaySectionReview() {
    setState(() {
      _showSectionReview = true;
      final section = _sections[_currentSection];
      final String sectionTitle = (section['title'] ?? '').toString();
      final String sectionName = (section['section'] ?? '').toString();

      _currentSectionAnswers = AnswerService.prepareSectionAnswers(
        section: section,
        sectionName: sectionName,
        sectionTitle: sectionTitle,
        selectedOptionsByField: _selectedOptionsByField,
        fieldTextByKey: _fieldTextByKey,
        fieldKey: _fieldKey,
        currentSection: _currentSection,
      );
    });
  }

  // ===== UI HELPER METHODS =====
  Widget _buildSectionReviewScreen() {
    if (_currentSectionAnswers == null) {
      return const Center(child: Text('Хэсэг хариулт олдсонгүй'));
    }

    final String sectionTitle = _currentSectionAnswers!['sectionTitle'] ?? '';
    final Map<String, dynamic> answersMap =
        _currentSectionAnswers!['answers'] as Map<String, dynamic>;

    debugPrint('=== SECTION REVIEW DEBUG ===');
    debugPrint('Section Title: $sectionTitle');
    debugPrint('Answers Map: $answersMap');
    debugPrint('Answers Map Keys: ${answersMap.keys.toList()}');
    answersMap.forEach((key, value) {
      debugPrint('Field $key: $value');
    });
    debugPrint('===========================');

    // Convert Map to List for UI display
    final List<Map<String, dynamic>> answers = answersMap.entries.map((entry) {
      return {
        'fieldId': entry.key,
        'question': entry.value['question'] ?? '',
        'status': entry.value['status'],
        'comment': entry.value['comment'],
      };
    }).toList();

    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 20),
          Icon(Icons.check_circle_outline, size: 80, color: AppColors.primary),
          const SizedBox(height: 20),
          Text(
            'Хэсэг дууссан',
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 16),
          Text(
            sectionTitle,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 20),
          Text(
            'Таны бөглөсөн хариултууд:',
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 16),
          Expanded(
            child: ListView.builder(
              itemCount: answers.length,
              itemBuilder: (context, index) {
                final answer = answers[index];
                final String question = answer['question'] ?? '';
                final String status = answer['status'] ?? '';
                final String comment = answer['comment'] ?? '';

                return Padding(
                  padding: const EdgeInsets.only(bottom: 12.0),
                  child: Card(
                    color: AppColors.surface,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(12.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            question.isNotEmpty
                                ? question
                                : 'Асуулт тодорхойлогдоогүй',
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.primary.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: AppColors.primary.withOpacity(0.3),
                              ),
                            ),
                            child: Text(
                              'Төлөв: $status',
                              style: const TextStyle(
                                fontSize: 12,
                                color: AppColors.primary,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                          if (comment.isNotEmpty) ...[
                            const SizedBox(height: 8),
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: Colors.blue[50],
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: Colors.blue[200]!),
                              ),
                              child: Row(
                                children: [
                                  Icon(
                                    Icons.note_alt_outlined,
                                    size: 16,
                                    color: Colors.blue[600],
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      'Тайлбар: $comment',
                                      style: TextStyle(
                                        fontSize: 13,
                                        color: Colors.blue[800],
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 46),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () {
                      setState(() {
                        _showSectionReview = false;
                        _currentSectionAnswers = null;
                      });
                    },
                    child: const Text('Өмнөх'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () async {
                      // Backend-руу хариулт илгээх
                      final section = _sections[_currentSection];
                      final sectionTitle = (section['title'] ?? '').toString();
                      final sectionName = (section['section'] ?? '').toString();

                      try {
                        final resp = await AnswerService.saveCurrentSection(
                          inspectionId: widget.inspectionId,
                          section: section,
                          sectionName: sectionName,
                          sectionTitle: sectionTitle,
                          selectedOptionsByField: _selectedOptionsByField,
                          fieldTextByKey: _fieldTextByKey,
                          fieldKey: _fieldKey,
                          currentSection: _currentSection,
                          totalSections: _totalSections,
                          answerId:
                              _answerId, // Metadata-аас ирсэн answerId ашиглах
                          deviceInfo: _deviceInfo,
                        );
                        // Section хариулт хадгалагдсаны дараа answerId шинэчлэх (хэрэв шаардлагатай бол)
                        try {
                          final dynamic data = (resp is Map<String, dynamic>)
                              ? (resp['data'] ?? resp)
                              : resp;
                          if (data is Map<String, dynamic>) {
                            final String? returnedId =
                                (data['answerId'] ?? data['id'] ?? data['_id'])
                                    ?.toString();
                            if (returnedId != null && returnedId.isNotEmpty) {
                              setState(() => _answerId = returnedId);
                            }
                          }
                        } catch (_) {}
                      } catch (e) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('Хэсэг хадгалахад алдаа гарлаа: $e'),
                            backgroundColor: Colors.red,
                          ),
                        );
                        return;
                      }

                      setState(() {
                        _showSectionReview = false;
                        _currentSectionAnswers = null;
                      });

                      _onFinish();
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.black,
                    ),
                    child: Text(
                      _currentSection >= (_totalSections - 1)
                          ? 'Дуусгах'
                          : 'Дараах',
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildVerificationScreen() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 20),
          Icon(
            Icons.verified_user_outlined,
            size: 80,
            color: AppColors.primary,
          ),
          const SizedBox(height: 20),
          Text(
            'Баталгаажуулах',
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 16),
          Text(
            'Таны бөглөсөн бүх хариултууд зөв эсэхийг шалгана уу. Баталгаажуулсны дараа үзлэг автоматаар илгээгдэх болно.',
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 16, color: Colors.grey),
          ),
          const SizedBox(height: 30),
          Card(
            color: AppColors.surface,
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Үзлэгийн мэдээлэл:',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                  _buildInfoRow('Нийт хэсэг:', '$_totalSections'),
                  _buildInfoRow('Бөглөгдсөн хэсэг:', '$_totalSections'),
                  _buildInfoRow('Дуусах хувь:', '100%'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          Text(
            'Бүх хариултууд:',
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 16),
          _buildAllAnswersReview(),
          const SizedBox(height: 20),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 46),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () {
                      setState(() {
                        _showVerification = false;
                      });
                    },
                    child: const Text('Өмнөх'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () {
                      // Navigate to conclusion page with inspection ID
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) =>
                              ConclusionPage(inspectionId: widget.inspectionId),
                        ),
                      );
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.black,
                    ),
                    child: const Text('Дүгнэлт бичих'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAllAnswersReview() {
    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: _sections.length,
      itemBuilder: (context, sectionIndex) {
        final section = _sections[sectionIndex];
        final String sectionTitle = (section['title'] ?? '').toString();
        final List<dynamic> fields = (section['fields'] as List<dynamic>);

        return Card(
          margin: const EdgeInsets.only(bottom: 16),
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${sectionIndex + 1}. $sectionTitle',
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(height: 12),
                ...fields.asMap().entries.map((fieldEntry) {
                  final int fieldIndex = fieldEntry.key;
                  final Map<String, dynamic> field = fieldEntry.value;
                  final String question = (field['question'] ?? '').toString();
                  final List<String> options =
                      (field['options'] as List<dynamic>)
                          .map((e) => e.toString())
                          .toList();
                  final String key = _fieldKey(sectionIndex, fieldIndex);
                  final Set<int> selectedIdx =
                      _selectedOptionsByField[key] ?? <int>{};
                  final List<String> selectedOptions = selectedIdx
                      .map((i) => options[i])
                      .toList();
                  final String text = (_fieldTextByKey[key] ?? '').trim();
                  final List<File> images = _fieldImagesByKey[key] ?? <File>[];

                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12.0),
                    child: Card(
                      color: AppColors.surface,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(12.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              question,
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(height: 8),
                            if (selectedOptions.isNotEmpty)
                              Wrap(
                                spacing: 8,
                                runSpacing: 4,
                                children: selectedOptions.map((option) {
                                  return Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 12,
                                      vertical: 6,
                                    ),
                                    decoration: BoxDecoration(
                                      color: AppColors.primary.withOpacity(0.1),
                                      borderRadius: BorderRadius.circular(16),
                                      border: Border.all(
                                        color: AppColors.primary.withOpacity(
                                          0.3,
                                        ),
                                      ),
                                    ),
                                    child: Text(
                                      option,
                                      style: const TextStyle(
                                        fontSize: 12,
                                        color: AppColors.primary,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                  );
                                }).toList(),
                              ),
                            if (text.isNotEmpty) ...[
                              const SizedBox(height: 8),
                              Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: Colors.blue[50],
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(color: Colors.blue[200]!),
                                ),
                                child: Row(
                                  children: [
                                    Icon(
                                      Icons.note_alt_outlined,
                                      size: 16,
                                      color: Colors.blue[600],
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        text,
                                        style: TextStyle(
                                          fontSize: 13,
                                          color: Colors.blue[800],
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                            if (images.isNotEmpty) ...[
                              const SizedBox(height: 8),
                              Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: Colors.green[50],
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(color: Colors.green[200]!),
                                ),
                                child: Row(
                                  children: [
                                    Icon(
                                      Icons.photo_library_outlined,
                                      size: 16,
                                      color: Colors.green[600],
                                    ),
                                    const SizedBox(width: 8),
                                    Text(
                                      'Зураг: ${images.length} ширхэг',
                                      style: TextStyle(
                                        fontSize: 13,
                                        color: Colors.green[800],
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 14)),
          Text(
            value,
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }
}
