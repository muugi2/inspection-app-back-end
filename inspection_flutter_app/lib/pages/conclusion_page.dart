import 'package:flutter/material.dart';
import 'package:app/assets/app_colors.dart';
import 'package:app/pages/dashboard_page.dart';
import 'package:app/services/api.dart';
import 'package:image_picker/image_picker.dart';
import 'package:signature/signature.dart';
import 'package:path_provider/path_provider.dart';
import 'dart:io';
import 'dart:typed_data';
import 'dart:convert';

class ConclusionPage extends StatefulWidget {
  final String inspectionId;

  const ConclusionPage({super.key, required this.inspectionId});

  @override
  State<ConclusionPage> createState() => _ConclusionPageState();
}

class _ConclusionPageState extends State<ConclusionPage> {
  final TextEditingController _conclusionController = TextEditingController();
  final FocusNode _conclusionFocusNode = FocusNode();
  bool _isSubmitting = false;

  // Гарын үсэгийн хувьсагч
  final SignatureController _signatureController = SignatureController(
    penStrokeWidth: 2,
    penColor: Colors.black,
    exportBackgroundColor: Colors.white,
  );
  File? _signatureImage;
  bool _hasSignature = false;

  // Хамгийн сүүлчийн section-ийн answerId
  String? _latestAnswerId;

  @override
  void initState() {
    super.initState();
    _loadLatestAnswerId();
  }

  @override
  void dispose() {
    _conclusionController.dispose();
    _conclusionFocusNode.dispose();
    _signatureController.dispose();
    super.dispose();
  }

  // Хамгийн сүүлчийн section-ийн answerId авах
  Future<void> _loadLatestAnswerId() async {
    try {
      debugPrint('=== LOADING LATEST ANSWER ID ===');
      debugPrint('Inspection ID: ${widget.inspectionId}');

      final result = await InspectionAPI.getLatestInspectionAnswerId(
        widget.inspectionId,
      );

      if (result != null && result['answerId'] != null) {
        setState(() {
          _latestAnswerId = result['answerId'].toString();
        });
        debugPrint('✅ Latest Answer ID loaded: $_latestAnswerId');
      } else {
        debugPrint('⚠️ No latest answer ID found');
      }
    } catch (e) {
      debugPrint('❌ Error loading latest answer ID: $e');
      // Алдаа гарвал null үлдээх
    }
  }

  // Gallery-аас зураг сонгох
  Future<void> _pickSignatureFromGallery() async {
    try {
      final ImagePicker picker = ImagePicker();
      final XFile? image = await picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 800,
        maxHeight: 400,
        imageQuality: 80,
      );

      if (image != null) {
        setState(() {
          _signatureImage = File(image.path);
          _hasSignature = true;
        });

        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Гарын үсэг амжилттай орууллаа'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Зураг сонгоход алдаа гарлаа: $e'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  // Гарын үсэг зурах
  Future<void> _drawSignature() async {
    final result = await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) =>
            SignatureDrawPage(signatureController: _signatureController),
      ),
    );

    if (result == true) {
      // Гарын үсгийг зураг болгон хадгалах
      await _saveSignatureAsImage();
      setState(() {
        _hasSignature = true;
      });
    }
  }

  // Гарын үсгийг зураг болгон хадгалах
  Future<void> _saveSignatureAsImage() async {
    try {
      if (_signatureController.isNotEmpty) {
        // Signature-г PNG bytes болгон экспортлох
        final Uint8List? signatureBytes = await _signatureController
            .toPngBytes();

        if (signatureBytes != null) {
          // Documents directory авах
          final Directory? documentsDir =
              await getApplicationDocumentsDirectory();
          if (documentsDir != null) {
            // Signatures folder үүсгэх
            final Directory signaturesDir = Directory(
              '${documentsDir.path}/signatures',
            );
            if (!await signaturesDir.exists()) {
              await signaturesDir.create(recursive: true);
            }

            // File нэр үүсгэх
            final String timestamp = DateTime.now().millisecondsSinceEpoch
                .toString();
            final String fileName = 'signature_$timestamp.png';
            final File signatureFile = File('${signaturesDir.path}/$fileName');

            // Bytes-г file болгон бичих
            await signatureFile.writeAsBytes(signatureBytes);

            setState(() {
              _signatureImage = signatureFile;
            });

            debugPrint(
              'Гарын үсэг амжилттай хадгалагдлаа: ${signatureFile.path}',
            );

            // Амжилттай мэдээлэл харуулах
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Row(
                    children: [
                      Icon(Icons.check_circle, color: Colors.white, size: 20),
                      const SizedBox(width: 8),
                      const Text('Гарын үсэг амжилттай хадгалагдлаа'),
                    ],
                  ),
                  backgroundColor: Colors.green[600],
                  behavior: SnackBarBehavior.floating,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
              );
            }
          }
        }
      }
    } catch (e) {
      debugPrint('Гарын үсэг хадгалахад алдаа гарлаа: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                Icon(Icons.error, color: Colors.white, size: 20),
                const SizedBox(width: 8),
                Text('Гарын үсэг хадгалахад алдаа гарлаа: $e'),
              ],
            ),
            backgroundColor: Colors.red[600],
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
          ),
        );
      }
    }
  }

  // Гарын үсэг устгах
  void _clearSignature() {
    // Файлыг устгах
    if (_signatureImage != null) {
      try {
        _signatureImage!.deleteSync();
        debugPrint('Гарын үсгийн файл устгагдлаа: ${_signatureImage!.path}');
      } catch (e) {
        debugPrint('Файл устгахад алдаа гарлаа: $e');
      }
    }

    setState(() {
      _signatureImage = null;
      _hasSignature = false;
      _signatureController.clear();
    });

    // Устгагдсаны мэдээлэл харуулах
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Icon(Icons.delete_outline, color: Colors.white, size: 20),
            const SizedBox(width: 8),
            const Text('Гарын үсэг устгагдлаа'),
          ],
        ),
        backgroundColor: Colors.orange[600],
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    );
  }

  // Гарын үсгийг backend-д илгээх
  Future<void> _submitSignature() async {
    debugPrint('=== SUBMITTING SIGNATURE FROM CONCLUSION PAGE ===');
    debugPrint('Inspection ID: ${widget.inspectionId}');
    debugPrint('Has Signature Image: ${_signatureImage != null}');

    if (_signatureImage == null) {
      debugPrint('❌ No signature image found');
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Гарын үсэг нэмэх шаардлагатай'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    try {
      debugPrint('📸 Converting signature image to base64...');
      debugPrint('Signature file path: ${_signatureImage!.path}');

      // Signature image-г base64 болгон хөрвүүлэх
      final Uint8List imageBytes = await _signatureImage!.readAsBytes();
      final String base64Image = base64Encode(imageBytes);
      final String dataUrl = 'data:image/png;base64,$base64Image';

      debugPrint('✅ Base64 conversion completed');
      debugPrint('Base64 length: ${base64Image.length}');
      debugPrint('Data URL length: ${dataUrl.length}');

      debugPrint('🚀 Sending signature to backend...');
      debugPrint('Using Answer ID: $_latestAnswerId');

      // Backend-д илгээх (answerId-тай холбох)
      final result = await InspectionAPI.submitSignatureImage(
        widget.inspectionId,
        dataUrl,
        signatureType: 'inspector',
        answerId: _latestAnswerId,
      );

      debugPrint('✅ Signature submitted successfully: $result');

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Гарын үсэг амжилттай хадгалагдлаа'),
          backgroundColor: Colors.green,
        ),
      );
    } catch (e) {
      debugPrint('❌ Error submitting signature: $e');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Гарын үсэг хадгалахад алдаа гарлаа: $e'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Дүгнэлт'),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: GestureDetector(
        onTap: () {
          // Keyboard-г хаах
          FocusScope.of(context).unfocus();
        },
        child: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [AppColors.primary, AppColors.background],
              stops: [0.0, 0.3],
            ),
          ),
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                const SizedBox(height: 20),
                const Text(
                  'Асуултын хариултуудыг хянаж дууссаны дүгнэлт',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Доорх талбарт дүгнэлтээ бичнэ үү:',
                  style: TextStyle(
                    fontSize: 14,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 24),
                Expanded(
                  child: Card(
                    color: AppColors.surface,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: TextField(
                        controller: _conclusionController,
                        focusNode: _conclusionFocusNode,
                        maxLines: null,
                        expands: true,
                        textAlignVertical: TextAlignVertical.top,
                        decoration: const InputDecoration(
                          hintText: 'Дүгнэлтээ энд бичнэ үү...',
                          border: InputBorder.none,
                          hintStyle: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 16,
                          ),
                        ),
                        style: const TextStyle(
                          fontSize: 16,
                          color: AppColors.textPrimary,
                          height: 1.5,
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                // Гарын үсэгийн хэсэг
                Container(
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: _hasSignature
                          ? Colors.green[200]!
                          : Colors.grey[200]!,
                      width: 1.5,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(
                          _hasSignature ? 0.15 : 0.08,
                        ),
                        blurRadius: _hasSignature ? 8 : 4,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(20.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Header
                        Row(
                          children: [
                            Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                gradient: LinearGradient(
                                  colors: _hasSignature
                                      ? [Colors.green[400]!, Colors.green[600]!]
                                      : [
                                          AppColors.primary,
                                          AppColors.secondary,
                                        ],
                                ),
                              ),
                              child: Icon(
                                _hasSignature ? Icons.check_circle : Icons.edit,
                                color: Colors.white,
                                size: 20,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Гарын үсэг',
                                    style: TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.bold,
                                      color: _hasSignature
                                          ? Colors.green[700]
                                          : AppColors.textPrimary,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    _hasSignature
                                        ? 'Гарын үсэг нэмэгдсэн'
                                        : 'Гарын үсэг нэмэх',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: _hasSignature
                                          ? Colors.green[600]
                                          : AppColors.textSecondary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            if (_hasSignature)
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 4,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.green[100],
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(
                                  '✓',
                                  style: TextStyle(
                                    color: Colors.green[700],
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 20),

                        // Гарын үсэгийн сонголт
                        if (!_hasSignature) ...[
                          Row(
                            children: [
                              Expanded(
                                child: Container(
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(
                                      color: Colors.blue[200]!,
                                    ),
                                    gradient: LinearGradient(
                                      colors: [
                                        Colors.blue[50]!,
                                        Colors.blue[100]!,
                                      ],
                                      begin: Alignment.topLeft,
                                      end: Alignment.bottomRight,
                                    ),
                                  ),
                                  child: Material(
                                    color: Colors.transparent,
                                    child: InkWell(
                                      borderRadius: BorderRadius.circular(12),
                                      onTap: _pickSignatureFromGallery,
                                      child: Padding(
                                        padding: const EdgeInsets.symmetric(
                                          vertical: 16,
                                          horizontal: 12,
                                        ),
                                        child: Column(
                                          children: [
                                            Icon(
                                              Icons.photo_library_rounded,
                                              color: Colors.blue[600],
                                              size: 28,
                                            ),
                                            const SizedBox(height: 8),
                                            Text(
                                              'Зураг оруулах',
                                              style: TextStyle(
                                                fontSize: 14,
                                                fontWeight: FontWeight.w600,
                                                color: Colors.blue[700],
                                              ),
                                            ),
                                            const SizedBox(height: 4),
                                            Text(
                                              'Gallery-аас сонгох',
                                              style: TextStyle(
                                                fontSize: 11,
                                                color: Colors.blue[600],
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 16),
                              Expanded(
                                child: Container(
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(
                                      color: Colors.green[200]!,
                                    ),
                                    gradient: LinearGradient(
                                      colors: [
                                        Colors.green[50]!,
                                        Colors.green[100]!,
                                      ],
                                      begin: Alignment.topLeft,
                                      end: Alignment.bottomRight,
                                    ),
                                  ),
                                  child: Material(
                                    color: Colors.transparent,
                                    child: InkWell(
                                      borderRadius: BorderRadius.circular(12),
                                      onTap: _drawSignature,
                                      child: Padding(
                                        padding: const EdgeInsets.symmetric(
                                          vertical: 16,
                                          horizontal: 12,
                                        ),
                                        child: Column(
                                          children: [
                                            Icon(
                                              Icons.edit_rounded,
                                              color: Colors.green[600],
                                              size: 28,
                                            ),
                                            const SizedBox(height: 8),
                                            Text(
                                              'Зурах',
                                              style: TextStyle(
                                                fontSize: 14,
                                                fontWeight: FontWeight.w600,
                                                color: Colors.green[700],
                                              ),
                                            ),
                                            const SizedBox(height: 4),
                                            Text(
                                              'Гарын үсэг зурах',
                                              style: TextStyle(
                                                fontSize: 11,
                                                color: Colors.green[600],
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],

                        // Гарын үсэг харуулах
                        if (_hasSignature) ...[
                          Container(
                            width: double.infinity,
                            height: 140,
                            decoration: BoxDecoration(
                              border: Border.all(
                                color: Colors.green[300]!,
                                width: 2,
                              ),
                              borderRadius: BorderRadius.circular(12),
                              gradient: LinearGradient(
                                colors: [Colors.green[50]!, Colors.white],
                                begin: Alignment.topCenter,
                                end: Alignment.bottomCenter,
                              ),
                            ),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(10),
                              child: _signatureImage != null
                                  ? Image.file(
                                      _signatureImage!,
                                      fit: BoxFit.contain,
                                    )
                                  : Signature(
                                      controller: _signatureController,
                                      backgroundColor: Colors.transparent,
                                    ),
                            ),
                          ),
                          const SizedBox(height: 16),
                          Row(
                            children: [
                              Expanded(
                                child: OutlinedButton.icon(
                                  onPressed: _clearSignature,
                                  icon: Icon(
                                    Icons.refresh_rounded,
                                    size: 18,
                                    color: Colors.orange[600],
                                  ),
                                  label: Text(
                                    'Солих',
                                    style: TextStyle(
                                      color: Colors.orange[600],
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  style: OutlinedButton.styleFrom(
                                    side: BorderSide(
                                      color: Colors.orange[300]!,
                                    ),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    padding: const EdgeInsets.symmetric(
                                      vertical: 12,
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: ElevatedButton.icon(
                                  onPressed: () {
                                    // Гарын үсэгийн сонголт дахин харуулах
                                    setState(() {
                                      _hasSignature = false;
                                    });
                                  },
                                  icon: const Icon(Icons.add_rounded, size: 18),
                                  label: const Text(
                                    'Нэмэх',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: AppColors.primary,
                                    foregroundColor: Colors.white,
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    padding: const EdgeInsets.symmetric(
                                      vertical: 12,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _isSubmitting
                        ? null
                        : () async {
                            if (_conclusionController.text.trim().isEmpty) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Дүгнэлт бичнэ үү'),
                                  backgroundColor: AppColors.secondary,
                                ),
                              );
                              return;
                            }

                            setState(() {
                              _isSubmitting = true;
                            });

                            try {
                              debugPrint(
                                '=== SUBMITTING CONCLUSION PAGE DATA ===',
                              );
                              debugPrint(
                                'Inspection ID: ${widget.inspectionId}',
                              );
                              debugPrint(
                                'Conclusion Text: ${_conclusionController.text.trim()}',
                              );
                              debugPrint('Has Signature: $_hasSignature');
                              debugPrint(
                                'Signature Image: ${_signatureImage != null}',
                              );

                              // Submit conclusion as remarks to existing inspection
                              debugPrint('📝 Submitting remarks/conclusion...');
                              debugPrint('Using Answer ID: $_latestAnswerId');
                              await InspectionAPI.submitConclusionAsField(
                                widget.inspectionId,
                                _conclusionController.text.trim(),
                                _latestAnswerId, // Хамгийн сүүлчийн section-тай холбох
                              );
                              debugPrint('✅ Remarks submitted successfully');

                              // Submit signature if exists
                              if (_hasSignature && _signatureImage != null) {
                                debugPrint('🖊️ Submitting signature...');
                                await _submitSignature();
                                debugPrint(
                                  '✅ Signature submitted successfully',
                                );
                              } else {
                                debugPrint('ℹ️ No signature to submit');
                              }

                              // Show success message
                              if (mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text(
                                      _hasSignature && _signatureImage != null
                                          ? 'Дүгнэлт болон гарын үсэг амжилттай хадгалагдлаа'
                                          : 'Дүгнэлт амжилттай нэмэгдлээ',
                                    ),
                                    backgroundColor: Colors.green,
                                  ),
                                );

                                // Navigate back to main dashboard
                                Navigator.of(context).pushAndRemoveUntil(
                                  MaterialPageRoute(
                                    builder: (_) => const DashboardPage(),
                                  ),
                                  (_) => false,
                                );
                              }
                            } catch (e) {
                              // Show error message
                              if (mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text(
                                      'Хадгалахад алдаа гарлаа: $e',
                                    ),
                                    backgroundColor: Colors.red,
                                  ),
                                );
                              }
                            } finally {
                              if (mounted) {
                                setState(() {
                                  _isSubmitting = false;
                                });
                              }
                            }
                          },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      elevation: 2,
                    ),
                    child: _isSubmitting
                        ? const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  valueColor: AlwaysStoppedAnimation<Color>(
                                    Colors.white,
                                  ),
                                ),
                              ),
                              SizedBox(width: 12),
                              Text(
                                'Нэмэж байна...',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          )
                        : const Text(
                            'Хадгалах',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                  ),
                ),
                  const SizedBox(height: 16),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// Гарын үсэг зурах тусдаа page
class SignatureDrawPage extends StatefulWidget {
  final SignatureController signatureController;

  const SignatureDrawPage({super.key, required this.signatureController});

  @override
  State<SignatureDrawPage> createState() => _SignatureDrawPageState();
}

class _SignatureDrawPageState extends State<SignatureDrawPage> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        title: const Text('Гарын үсэг зурах'),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 8),
            child: IconButton(
              onPressed: () {
                widget.signatureController.clear();
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Цэвэрлэгдлээ'),
                    backgroundColor: Colors.orange,
                    duration: Duration(seconds: 1),
                  ),
                );
              },
              icon: const Icon(Icons.refresh_rounded),
              tooltip: 'Цэвэрлэх',
            ),
          ),
        ],
      ),
      body: GestureDetector(
        onTap: () {
          // Keyboard-г хаах
          FocusScope.of(context).unfocus();
        },
        child: Column(
          children: [
          // Зааварчилгаа
          Container(
            width: double.infinity,
            margin: const EdgeInsets.all(16),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.blue[50],
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.blue[200]!),
            ),
            child: Row(
              children: [
                Icon(Icons.info_outline, color: Colors.blue[600], size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Дээрх талбарт гарын үсэгээ зураарай. Хэрэв алдаа гарвал "Цэвэрлэх" товчийг дарж дахин оролдоно уу.',
                    style: TextStyle(
                      fontSize: 13,
                      color: Colors.blue[700],
                      height: 1.3,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Товчнууд (дээшлүүлсэн)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            margin: const EdgeInsets.only(bottom: 16),
            child: Row(
              children: [
                Expanded(
                  child: Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.grey[300]!),
                    ),
                    child: Material(
                      color: Colors.transparent,
                      child: InkWell(
                        borderRadius: BorderRadius.circular(12),
                        onTap: () {
                          Navigator.of(context).pop(false);
                        },
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.close_rounded,
                                color: Colors.grey[600],
                                size: 20,
                              ),
                              const SizedBox(width: 8),
                              Text(
                                'Цуцлах',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.grey[600],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      gradient: LinearGradient(
                        colors: [AppColors.primary, AppColors.secondary],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                    ),
                    child: Material(
                      color: Colors.transparent,
                      child: InkWell(
                        borderRadius: BorderRadius.circular(12),
                        onTap: () {
                          if (widget.signatureController.isEmpty) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Row(
                                  children: [
                                    Icon(
                                      Icons.warning_rounded,
                                      color: Colors.white,
                                      size: 20,
                                    ),
                                    const SizedBox(width: 8),
                                    const Text('Гарын үсэг зураагүй байна'),
                                  ],
                                ),
                                backgroundColor: Colors.red[600],
                                behavior: SnackBarBehavior.floating,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(8),
                                ),
                              ),
                            );
                            return;
                          }
                          Navigator.of(context).pop(true);
                        },
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(
                                Icons.check_rounded,
                                color: Colors.white,
                                size: 20,
                              ),
                              const SizedBox(width: 8),
                              const Text(
                                'Хадгалах',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.white,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Гарын үсэг зурах талбар
          Expanded(
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.1),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
                border: Border.all(color: Colors.grey[300]!, width: 2),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(14),
                child: Signature(
                  controller: widget.signatureController,
                  backgroundColor: Colors.white,
                ),
              ),
            ),
          ),
          ],
        ),
      ),
    );
  }
}
