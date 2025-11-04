'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { authUtils, User } from '@/lib/auth';
import { apiService } from '@/lib/api';
import mammoth from 'mammoth';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface InspectionAnswer {
  id: string;
  inspectionId: string;
  answers: any;
  answeredBy: string;
  answeredAt: string;
  createdAt: string;
  updatedAt: string;
  inspection?: {
    id: string;
    title: string;
    type: string;
    status: string;
    device?: {
      serialNumber: string;
      assetTag: string;
      model?: {
        manufacturer: string;
        model: string;
      };
      site?: {
        name: string;
        organization?: {
          name: string;
          code: string;
        };
      };
    };
    assignee?: {
      fullName: string;
      organization?: {
        name: string;
      };
    };
  };
  user?: {
    fullName: string;
    organization?: {
      name: string;
    };
  };
}

export default function InspectionAnswerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [user, setUser] = useState<User | null>(null);
  const [answer, setAnswer] = useState<InspectionAnswer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [questionImages, setQuestionImages] = useState<any[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const router = useRouter();
  
  // Unwrap the params Promise
  const resolvedParams = use(params);

  useEffect(() => {
    const initializePage = async () => {
      // Check if user is authenticated
      if (!authUtils.isAuthenticated()) {
        router.push('/login');
        return;
      }

      // Get user data
      const currentUser = authUtils.getUser();
      if (currentUser) {
        setUser(currentUser);
      }

      // Load inspection answer
      await loadInspectionAnswer();
    };

    initializePage();
  }, [router, resolvedParams.id]);

  const loadInspectionAnswer = async () => {
    try {
      setIsLoading(true);
      const response = await apiService.inspectionAnswers.getById(resolvedParams.id);
      console.log('=== Load Inspection Answer ===');
      console.log('Answer ID:', resolvedParams.id);
      console.log('Full response:', response);
      console.log('Response data:', response.data);
      console.log('InspectionId from response.data.inspectionId:', response.data?.inspectionId);
      console.log('InspectionId from response.data.inspection?.id:', response.data?.inspection?.id);
      
      setAnswer(response.data);
      
      // Load template document with answer data
      if (response.data) {
        await loadTemplateWithData(resolvedParams.id);
        // Load question images using answerId
        const answerId = response.data.id || response.data.answerId || resolvedParams.id;
        console.log('Final answerId to use:', answerId);
        if (answerId) {
          console.log('Calling loadQuestionImages with answerId:', answerId);
          await loadQuestionImages(answerId);
        } else {
          console.warn('No answerId found in response.data');
        }
      }
    } catch (err: any) {
      console.error('Failed to load inspection answer:', err);
      setError('Үзлэгийн хариултыг ачаалахад алдаа гарлаа');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to get nested value from object using dot notation
  const getNestedValue = (obj: any, path: string): any => {
    return path.split('.').reduce((current, key) => {
      if (current && typeof current === 'object') {
        return current[key];
      }
      return undefined;
    }, obj);
  };

  // Helper function to replace Carbone placeholders in HTML
  const replacePlaceholders = (html: string, dataMap: any): string => {
    let processedHtml = html;
    
    // Replace Carbone-style placeholders: {d.field.subfield} or {data.field} or {field}
    const placeholderPattern = /\{([a-zA-Z_][a-zA-Z0-9_\.\s]*[a-zA-Z0-9_]+)\}/g;
    
    processedHtml = processedHtml.replace(placeholderPattern, (match, placeholder) => {
      // Remove spaces and normalize the placeholder
      const normalizedPlaceholder = placeholder.replace(/\s+/g, '');
      
      let value = undefined;
      
      if (normalizedPlaceholder.startsWith('d.')) {
        const pathWithoutD = normalizedPlaceholder.substring(2);
        
        // Check for signature fields in d. paths
        if (pathWithoutD.toLowerCase().includes('inspector') || pathWithoutD.toLowerCase().includes('signature')) {
          const signaturePaths = [
            normalizedPlaceholder,
            `signatures.${pathWithoutD.replace(/^(signatures\.|data\.signatures\.|metadata\.signatures\.)/, '')}`,
            `signatures.inspector`,
            `data.signatures.inspector`,
            `metadata.signatures.inspector`,
            `d.signatures.inspector`,
            `d.data.signatures.inspector`,
            `d.metadata.signatures.inspector`,
          ];
          
          for (const path of signaturePaths) {
            value = getNestedValue(dataMap, path);
            if (value !== undefined && value !== null) break;
          }
        }
        
        const paths = [
          normalizedPlaceholder,
          `metadata.${pathWithoutD.replace(/^metadata\./, '')}`,
          `data.${pathWithoutD}`,
          `signatures.${pathWithoutD.replace(/^(signatures\.|data\.signatures\.|metadata\.signatures\.)/, '')}`,
          pathWithoutD,
          `d.data.${pathWithoutD.replace(/^data\./, '')}`,
          `d.metadata.${pathWithoutD.replace(/^metadata\./, '')}`,
          `d.signatures.${pathWithoutD.replace(/^(signatures\.|data\.signatures\.|metadata\.signatures\.)/, '')}`,
          `data.metadata.${pathWithoutD.replace(/^metadata\./, '')}`,
          pathWithoutD.replace(/^metadata\./, ''),
        ];
        
        for (const path of paths) {
          value = getNestedValue(dataMap, path);
          if (value !== undefined && value !== null) {
            break;
          }
        }
      } else if (normalizedPlaceholder.startsWith('data.')) {
        const paths = [
          normalizedPlaceholder,
          normalizedPlaceholder.replace('data.', 'metadata.'),
          normalizedPlaceholder.replace('data.', 'signatures.'),
          `signatures.${normalizedPlaceholder.replace('data.', '').replace(/^signatures\./, '')}`,
        ];
        for (const path of paths) {
          value = getNestedValue(dataMap, path);
          if (value !== undefined && value !== null) break;
        }
      } else if (normalizedPlaceholder.startsWith('metadata.')) {
        const metadataField = normalizedPlaceholder.replace('metadata.', '');
        const paths = [
          normalizedPlaceholder,
          normalizedPlaceholder.replace('metadata.', 'data.'),
          normalizedPlaceholder.replace('metadata.', 'signatures.'),
          `signatures.${metadataField.replace(/^signatures\./, '')}`,
          metadataField,
          `data.${normalizedPlaceholder}`,
          `d.data.${normalizedPlaceholder}`,
          `d.metadata.${metadataField}`,
          `d.signatures.${metadataField.replace(/^signatures\./, '')}`,
          `metadata.${metadataField}`,
        ];
        for (const path of paths) {
          value = getNestedValue(dataMap, path);
          if (value !== undefined && value !== null) break;
        }
      } else {
        // Check for signature fields specifically
        if (normalizedPlaceholder.toLowerCase().includes('inspector') || normalizedPlaceholder.toLowerCase().includes('signature')) {
          const signaturePaths = [
            `signatures.inspector`,
            `signatures.${normalizedPlaceholder}`,
            `data.signatures.inspector`,
            `data.signatures.${normalizedPlaceholder}`,
            `metadata.signatures.inspector`,
            `metadata.signatures.${normalizedPlaceholder}`,
            `d.signatures.inspector`,
            `d.data.signatures.inspector`,
            `d.metadata.signatures.inspector`,
            `metadata.${normalizedPlaceholder}`,
            normalizedPlaceholder,
          ];
          
          for (const path of signaturePaths) {
            value = getNestedValue(dataMap, path);
            if (value !== undefined && value !== null) break;
          }
        }
        
        const paths = [
          `data.${normalizedPlaceholder}`,
          `metadata.${normalizedPlaceholder}`,
          `signatures.${normalizedPlaceholder}`,
          normalizedPlaceholder,
          `d.data.${normalizedPlaceholder}`,
          `d.metadata.${normalizedPlaceholder}`,
          `d.signatures.${normalizedPlaceholder}`,
        ];
        
        for (const path of paths) {
          value = getNestedValue(dataMap, path);
          if (value !== undefined && value !== null) break;
        }
      }
      
      // Format the value
      if (value !== undefined && value !== null) {
        if (typeof value === 'object' && value !== null) {
          if (value.status !== undefined) {
            return String(value.status);
          }
          if (value.comment !== undefined) {
            return String(value.comment);
          } 
          if (value.answer !== undefined) {
            return String(value.answer);
          }
          return JSON.stringify(value);
        }
        
        const stringValue = String(value);
        
        // Check if value is a base64 image (data:image or base64 string)
        if (stringValue.startsWith('data:image/')) {
          // Already a data URL, return as image tag
          return `<img src="${stringValue}" alt="Гарын үсэг" style="max-width: 200px; height: auto; border: 1px solid #ccc; border-radius: 4px; display: block; margin: 10px 0;" />`;
        } else if (stringValue.length > 50) {
          // Try to detect if it's a base64 string
          // Base64 strings are typically longer and contain only base64 characters
          const cleanedValue = stringValue.replace(/\s/g, '').replace(/\n/g, '');
          const base64Pattern = /^[A-Za-z0-9+/=]+$/;
          
          if (base64Pattern.test(cleanedValue) && cleanedValue.length > 50) {
            // Looks like base64 string
            // Try to detect image type from base64 signature
            let imageType = 'png'; // default
            const firstChar = cleanedValue.charAt(0);
            
            // Base64 image signatures:
            // PNG: iVBORw0KGgo
            // JPEG: /9j/4AAQ
            // GIF: R0lGODlh
            // WebP: UklGR
            if (cleanedValue.startsWith('iVBORw0KGgo') || cleanedValue.startsWith('iVBOR')) {
              imageType = 'png';
            } else if (cleanedValue.startsWith('/9j/') || cleanedValue.startsWith('/9j')) {
              imageType = 'jpeg';
            } else if (cleanedValue.startsWith('R0lGODlh') || cleanedValue.startsWith('R0lGOD')) {
              imageType = 'gif';
            } else if (cleanedValue.startsWith('UklGR') || cleanedValue.startsWith('UklGRg')) {
              imageType = 'webp';
            } else {
              // Default to png for signature images
              imageType = 'png';
            }
            
            const dataUrl = `data:image/${imageType};base64,${cleanedValue}`;
            return `<img src="${dataUrl}" alt="Гарын үсэг" style="max-width: 200px; height: auto; border: 1px solid #ccc; border-radius: 4px; display: block; margin: 10px 0;" />`;
          }
        }
        
        return stringValue;
      }
      
      return '';
    });
    
    return processedHtml;
  };

  const loadQuestionImages = async (answerId: string) => {
    try {
      setImagesLoading(true);
      console.log('=== Loading Question Images ===');
      console.log('Answer ID:', answerId);
      console.log('Answer ID type:', typeof answerId);
      const response = await apiService.inspectionAnswers.getQuestionImages(answerId);
      console.log('Question images response:', response);
      console.log('Response keys:', Object.keys(response || {}));
      
      // API service returns response.data, so check response.data structure
      if (response && response.data && Array.isArray(response.data.images)) {
        setQuestionImages(response.data.images);
        console.log('Loaded question images:', response.data.images.length);
      } else if (response && Array.isArray(response.images)) {
        // Handle case where images are at root level
        setQuestionImages(response.images);
        console.log('Loaded question images (root level):', response.images.length);
      } else {
        console.log('No images found in response. Response structure:', {
          hasResponse: !!response,
          hasData: !!response?.data,
          hasImages: !!response?.images,
          hasDataImages: !!response?.data?.images,
          responseKeys: response ? Object.keys(response) : [],
        });
        setQuestionImages([]);
      }
    } catch (err: any) {
      console.error('Failed to load question images:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        stack: err.stack,
      });
      // Show error to user for debugging
      setError(`Зургууд ачаалахад алдаа гарлаа: ${err.message}`);
      setQuestionImages([]);
    } finally {
      setImagesLoading(false);
    }
  };

  const loadTemplateWithData = async (answerId: string) => {
    try {
      setError('');
      
      // Get inspection answer with data
      const answerResponse = await apiService.inspectionAnswers.getById(answerId);
      const answer = answerResponse.data || answerResponse;
      
      // Parse answers if it's a string
      let answerJson = answer?.answers || answer?.data || {};
      if (typeof answerJson === 'string') {
        try {
          answerJson = JSON.parse(answerJson);
        } catch (e) {
          console.error('Failed to parse answerJson:', e);
        }
      }
      
      console.log('Raw answer data:', {
        hasAnswers: !!answer?.answers,
        answersType: typeof answer?.answers,
        answerJsonKeys: Object.keys(answerJson),
        hasSignatures: !!answerJson.signatures,
      });
      
      // Extract metadata (can be at root level or inside data)
      const metadata = answerJson.metadata || answerJson.data?.metadata || {};
      
      // Extract signatures (can be at various locations)
      // Check root level first, then nested locations
      const signatures = answerJson.signatures || 
                        answerJson.data?.signatures || 
                        metadata.signatures || 
                        (answerJson.data && answerJson.data.signatures) ||
                        {};
      
      console.log('Signature extraction:', {
        rootLevel: !!answerJson.signatures,
        dataLevel: !!answerJson.data?.signatures,
        metadataLevel: !!metadata.signatures,
        finalSignatures: signatures,
        inspectorExists: !!signatures.inspector,
        inspectorValue: signatures.inspector ? String(signatures.inspector).substring(0, 50) : 'none',
      });
      
      // Build comprehensive data map for placeholder replacement
      const inspection = answer?.inspection || {};
      const device = inspection?.device || {};
      const site = device?.site || {};
      const organization = site?.organization || device?.organization || {};
      const assignee = inspection?.assignee || {};
      const user = answer?.user || {};
      
      // Get the actual data object (nested or direct)
      const actualData = answerJson.data || answerJson;
      
      // Merge metadata fields directly into data object for easy access
      const dataWithMetadata = { ...actualData };
      if (metadata && Object.keys(metadata).length > 0) {
        Object.assign(dataWithMetadata, metadata);
        dataWithMetadata.metadata = metadata;
      }
      
      // Merge signatures into dataWithMetadata
      if (signatures && Object.keys(signatures).length > 0) {
        dataWithMetadata.signatures = signatures;
      }
      
      // Create data map compatible with Carbone format
      const dataMap = {
        ...answerJson,
        data: dataWithMetadata,
        metadata: metadata,
        signatures: signatures,
        ...(metadata && Object.keys(metadata).length > 0 ? metadata : {}),
        ...(signatures && Object.keys(signatures).length > 0 ? signatures : {}),
        inspection: {
          id: inspection?.id?.toString() || '',
          title: inspection?.title || '',
          type: inspection?.type || '',
          status: inspection?.status || '',
        },
        device: {
          serialNumber: device?.serialNumber || '',
          assetTag: device?.assetTag || '',
          model: device?.model ? {
            manufacturer: device.model.manufacturer || '',
            model: device.model.model || ''
          } : null,
        },
        contractor: {
          company: organization?.name || '',
          code: organization?.code || '',
        },
        organization: {
          name: organization?.name || '',
          code: organization?.code || '',
        },
        site: {
          name: site?.name || '',
        },
        user: {
          fullName: user?.fullName || '',
          organization: user?.organization ? {
            name: user.organization.name || '',
            code: user.organization.code || ''
          } : null,
        },
        assignee: {
          fullName: assignee?.fullName || '',
          organization: assignee?.organization ? {
            name: assignee.organization.name || '',
            code: assignee.organization.code || ''
          } : null,
        },
        d: {
          contractor: {
            company: organization?.name || '',
          },
          device: {
            serialNumber: device?.serialNumber || '',
            assetTag: device?.assetTag || '',
          },
          data: dataWithMetadata,
          metadata: metadata,
          signatures: signatures,
        },
      };
      
      // Debug: Log signature data
      console.log('Signature data:', {
        signatures,
        inspector: signatures.inspector,
        hasInspector: !!signatures.inspector,
        inspectorLength: signatures.inspector?.length || 0,
        inspectorType: typeof signatures.inspector,
        inspectorPreview: signatures.inspector?.substring(0, 50) || 'none',
      });
      
      // Also check answerJson directly
      console.log('Answer JSON structure:', {
        hasSignatures: !!answerJson.signatures,
        hasDataSignatures: !!answerJson.data?.signatures,
        answerJsonKeys: Object.keys(answerJson),
      });
      
      // Fetch the .docx file from backend
      const arrayBuffer = await apiService.documents.getTemplate('auto_scale_inspection_template_fin.docx');
      
      // Convert .docx to HTML using mammoth
      const result = await mammoth.convertToHtml(
        { arrayBuffer },
        {
          styleMap: [
            "p[style-name='Title'] => h1.title:fresh",
            "p[style-name='Heading 1'] => h1.heading1:fresh",
            "p[style-name='Heading 2'] => h2.heading2:fresh",
            "p[style-name='Heading 3'] => h3.heading3:fresh",
            "r[style-name='Strong'] => strong",
            "r[style-name='Emphasis'] => em",
          ],
          includeDefaultStyleMap: true,
          convertImage: mammoth.images.imgElement(function(image) {
            return image.read("base64").then(function(imageBuffer) {
              return {
                src: "data:" + image.contentType + ";base64," + imageBuffer
              };
            });
          }),
        }
      );
      
      // Replace placeholders with actual data
      let populatedHtml = replacePlaceholders(result.value, dataMap);
      
      // Always add signature section if signature exists (regardless of placeholder)
      // Try multiple ways to find signature
      let inspectorSignature = null;
      
      // Try to find signature in various locations
      if (signatures && signatures.inspector) {
        inspectorSignature = String(signatures.inspector);
      } else if (answerJson.signatures && answerJson.signatures.inspector) {
        inspectorSignature = String(answerJson.signatures.inspector);
      } else if (answerJson.data && answerJson.data.signatures && answerJson.data.signatures.inspector) {
        inspectorSignature = String(answerJson.data.signatures.inspector);
      } else if (metadata && metadata.signatures && metadata.signatures.inspector) {
        inspectorSignature = String(metadata.signatures.inspector);
      }
      
      console.log('Signature search result:', {
        found: !!inspectorSignature,
        length: inspectorSignature?.length || 0,
        preview: inspectorSignature?.substring(0, 100) || 'none',
      });
      
      if (inspectorSignature && inspectorSignature.length > 0) {
        let signatureImg = '';
        
        if (inspectorSignature.startsWith('data:image/')) {
          // Already a data URL - use directly
          signatureImg = `<img src="${inspectorSignature}" alt="Гарын үсэг" style="max-width: 200px; height: auto; border: 1px solid #ccc; border-radius: 4px; display: block; margin: 10px 0;" />`;
          console.log('✅ Created signature img tag from data URL');
        } else {
          // Try to detect base64 string
          const cleanedValue = inspectorSignature.replace(/\s/g, '').replace(/\n/g, '');
          if (cleanedValue.length > 50 && /^[A-Za-z0-9+/=]+$/.test(cleanedValue)) {
            let imageType = 'png';
            if (cleanedValue.startsWith('iVBORw0KGgo') || cleanedValue.startsWith('iVBOR')) {
              imageType = 'png';
            } else if (cleanedValue.startsWith('/9j/') || cleanedValue.startsWith('/9j')) {
              imageType = 'jpeg';
            }
            const dataUrl = `data:image/${imageType};base64,${cleanedValue}`;
            signatureImg = `<img src="${dataUrl}" alt="Гарын үсэг" style="max-width: 200px; height: auto; border: 1px solid #ccc; border-radius: 4px; display: block; margin: 10px 0;" />`;
            console.log('✅ Created signature img tag from base64');
          } else {
            console.log('❌ Could not create signature img - invalid format:', {
              length: cleanedValue.length,
              isValidBase64: /^[A-Za-z0-9+/=]+$/.test(cleanedValue),
            });
          }
        }
        
        // Always add signature section if we have an image tag
        if (signatureImg) {
          populatedHtml += `
            <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #000;">
              <h3 style="font-size: 14pt; font-weight: bold; margin-bottom: 10px;">Гарын үсэг</h3>
              ${signatureImg}
            </div>
          `;
          console.log('✅ Signature section added to HTML');
        } else {
          console.log('❌ Could not create signature image tag');
        }
      } else {
        console.log('❌ No signature found in any location');
      }
      
      // Final check: ensure signature is in HTML
      console.log('Final HTML check:', {
        htmlLength: populatedHtml.length,
        containsSignature: populatedHtml.includes('Гарын үсэг'),
        containsDataImage: populatedHtml.includes('data:image/'),
        htmlPreview: populatedHtml.substring(populatedHtml.length - 500),
      });
      
      setHtmlContent(populatedHtml);
      
      // Log any warnings
      if (result.messages.length > 0) {
        console.warn('Conversion warnings:', result.messages);
      }
    } catch (err: any) {
      console.error('Failed to load template:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Баримт файл ачаалахад алдаа гарлаа';
      setError(errorMessage);
      setHtmlContent('');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'submitted': return 'bg-blue-100 text-blue-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'inspection': return 'bg-blue-100 text-blue-800';
      case 'maintenance': return 'bg-orange-100 text-orange-800';
      case 'installation': return 'bg-purple-100 text-purple-800';
      case 'verification': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const downloadPDF = async () => {
    try {
      // Find the document preview element (matches DOCX display format)
      const element = document.querySelector('.document-preview') as HTMLElement;
      
      if (!element || !htmlContent) {
        setError('Баримт ачаалаагүй байна. Эхлээд баримтыг ачаална уу.');
        return;
      }

      // Create PDF with A4 dimensions matching DOCX format exactly
      // DOCX template uses: 8.5in x 11in (A4), 1in margins = 25.4mm
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // Match DOCX template dimensions exactly
      // Template: 8.5in width, 11in height, 1in margins on all sides
      const pageWidth = 210; // A4 width in mm (8.5in * 25.4mm)
      const pageHeight = 297; // A4 height in mm (11in * 25.4mm)
      const margin = 25.4; // 1 inch = 25.4mm (matching DOCX template)
      const contentWidth = pageWidth - (margin * 2); // 159.2mm
      const contentHeight = pageHeight - (margin * 2); // 246.2mm

      // Capture the document preview element which matches DOCX format
      const canvas = await html2canvas(element, {
        scale: 2, // Higher scale for better quality
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: element.offsetWidth,
        height: element.offsetHeight,
      });

      // Calculate dimensions to match DOCX format exactly
      // The document preview is already formatted like DOCX (8.5in x 11in with 1in margins)
      const imgWidth = contentWidth; // 159.2mm (6.5in)
      const imgHeight = (canvas.height * contentWidth) / canvas.width; // Maintain aspect ratio
      
      // Add image to PDF with proper margins matching DOCX
      // If content fits on one page, add it directly
      const imgData = canvas.toDataURL('image/png');
      if (imgHeight <= contentHeight) {
        pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight);
      } else {
        // Split across multiple pages
        let remainingHeight = imgHeight;
        let sourceY = 0;
        let isFirstPage = true;
        
        while (remainingHeight > 0) {
          if (!isFirstPage) {
            pdf.addPage();
          }
          isFirstPage = false;
          
          const pageHeight = Math.min(contentHeight, remainingHeight);
          const sourceHeight = (pageHeight / imgHeight) * canvas.height;
          
          // Create a canvas for this page slice
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = canvas.width;
          pageCanvas.height = sourceHeight;
          const ctx = pageCanvas.getContext('2d');
          
          if (ctx) {
            ctx.drawImage(
              canvas,
              0, sourceY,
              canvas.width, sourceHeight,
              0, 0,
              canvas.width, sourceHeight
            );
          }
          
          const pageImgData = pageCanvas.toDataURL('image/png');
          pdf.addImage(pageImgData, 'PNG', margin, margin, imgWidth, pageHeight);
          
          remainingHeight -= pageHeight;
          sourceY += sourceHeight;
        }
      }

      // Generate filename
      const inspectionTitle = answer?.inspection?.title || 'үзлэг';
      const sanitizedTitle = inspectionTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const date = new Date().toISOString().split('T')[0];
      const filename = `үзлэгийн_баримт_${sanitizedTitle}_${date}.pdf`;

      // Save PDF
      pdf.save(filename);
      setShowDownloadMenu(false);
    } catch (err: any) {
      console.error('Failed to generate PDF:', err);
      setError('PDF үүсгэхэд алдаа гарлаа: ' + (err.message || 'Үл мэдэгдэх алдаа'));
    }
  };

  const downloadDOCX = async () => {
    try {
      const blob = await apiService.documents.generateDocument(resolvedParams.id, 'docx');
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename
      const inspectionTitle = answer?.inspection?.title || 'үзлэг';
      const sanitizedTitle = inspectionTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const date = new Date().toISOString().split('T')[0];
      link.download = `үзлэгийн_баримт_${sanitizedTitle}_${date}.docx`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setShowDownloadMenu(false);
    } catch (err: any) {
      console.error('Failed to download DOCX:', err);
      setError('DOCX татаж авахад алдаа гарлаа: ' + (err.message || 'Үл мэдэгдэх алдаа'));
    }
  };

  const handlePrint = () => {
    window.print();
    setShowDownloadMenu(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Ачаалж байна...</p>
        </div>
      </div>
    );
  }

  if (!answer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500">Үзлэгийн хариулт олдсонгүй</p>
          <button
            onClick={() => router.push('/inspection-answers')}
            className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Буцах
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="px-6 py-4 flex justify-between items-center">
          <div>
            <button
              onClick={() => router.push('/inspection-answers')}
              className="text-indigo-600 hover:text-indigo-800 mb-2 text-sm font-medium"
            >
              ← Буцах
            </button>
            <h1 className="text-xl font-bold text-gray-900">Үзлэгийн Загвар Баримт</h1>
            <p className="text-sm text-gray-500">
              {answer.inspection?.title || 'Үзлэгийн хариулт'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right mr-4">
              <p className="text-sm font-medium text-gray-900">{user?.fullName}</p>
              <p className="text-sm text-gray-500">{user?.organization.name}</p>
            </div>
            <button
              onClick={() => loadTemplateWithData(resolvedParams.id)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              🔄 Шинэчлэх
            </button>
            
            {/* Download Menu */}
            <div className="relative">
              <button
                onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2"
              >
                📥 Татаж авах
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showDownloadMenu && (
                <>
                  {/* Backdrop to close menu */}
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowDownloadMenu(false)}
                  />
                  
                  {/* Dropdown menu */}
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-20 border border-gray-200">
                    <div className="py-1">
                      <button
                        onClick={downloadPDF}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                      >
                        <span>📄</span>
                        <span>PDF татаж авах</span>
                      </button>
                      <button
                        onClick={downloadDOCX}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                      >
                        <span>📝</span>
                        <span>DOCX татаж авах</span>
                      </button>
                      <button
                        onClick={handlePrint}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                      >
                        <span>🖨️</span>
                        <span>Хэвлэх</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="text-red-800">{error}</div>
            <button 
              onClick={() => loadTemplateWithData(resolvedParams.id)}
              className="mt-2 text-red-600 hover:text-red-800 text-sm underline"
            >
              Дахин ачаалах
            </button>
          </div>
        )}

        {/* Document Content */}
        {htmlContent && (
          <div className="bg-gray-100 p-8 flex justify-center">
            <div 
              className="document-preview bg-white shadow-2xl"
              style={{
                width: '8.5in',
                minHeight: '11in',
                padding: '1in',
                fontFamily: '"Times New Roman", "Times", serif',
                fontSize: '12pt',
                lineHeight: '1.15',
                color: '#000000',
              }}
            >
              <div 
                className="document-content"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
                style={{
                  fontFamily: '"Times New Roman", "Times", serif',
                  fontSize: '12pt',
                  lineHeight: '1.15',
                  color: '#000000',
                }}
              />
            </div>
          </div>
        )}

        {!htmlContent && !error && !isLoading && (
          <div className="text-center py-12">
            <p className="text-gray-500">Баримт ачаалах боломжгүй байна</p>
          </div>
        )}


        {/* Question Images Section - Display below PDF preview */}
        {answer && (answer.inspectionId || answer.inspection?.id) && htmlContent && (
          <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Асуултын Зургууд</h2>
            {imagesLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="mt-2 text-gray-600 text-sm">Зургууд ачаалж байна...</p>
              </div>
            ) : questionImages.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>Энэ үзлэгт асуултын зураг олдсонгүй</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Group images by section and field */}
                {Object.entries(
                  questionImages.reduce((acc: any, img: any) => {
                    const key = `${img.section}-${img.fieldId}`;
                    if (!acc[key]) {
                      acc[key] = {
                        section: img.section,
                        fieldId: img.fieldId,
                        images: [],
                      };
                    }
                    acc[key].images.push(img);
                    return acc;
                  }, {} as any)
                ).map(([key, group]: [string, any]) => (
                  <div key={key} className="border border-gray-200 rounded-lg p-4">
                    <div className="mb-3">
                      <h3 className="font-semibold text-gray-800">{group.section}</h3>
                      <p className="text-sm text-gray-600">Field ID: {group.fieldId}</p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {group.images
                        .sort((a: any, b: any) => a.order - b.order)
                        .map((img: any) => {
                          const imageDataUrl = img.imageData && img.imageData.startsWith('data:image/')
                            ? img.imageData
                            : img.imageData
                            ? `data:${img.mimeType || 'image/jpeg'};base64,${img.imageData}`
                            : '';
                          if (!imageDataUrl) return null;
                          return (
                            <div key={img.id} className="relative group">
                              <img
                                src={imageDataUrl}
                                alt={`${group.section} - ${group.fieldId} - Image ${img.order}`}
                                className="w-full h-48 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => {
                                  // Open image in new window for full size
                                  const newWindow = window.open();
                                  if (newWindow) {
                                    newWindow.document.write(`
                                      <html>
                                        <head><title>Image ${img.order}</title></head>
                                        <body style="margin:0;padding:20px;background:#000;display:flex;justify-content:center;align-items:center;min-height:100vh;">
                                          <img src="${imageDataUrl}" style="max-width:100%;max-height:100vh;object-fit:contain;" />
                                        </body>
                                      </html>
                                    `);
                                  }
                                }}
                              />
                              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 rounded-b-lg">
                                Зураг {img.order}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Custom Styles for Word-like appearance */}
      <style jsx global>{`
        .document-preview {
          /* Word default page settings */
        }
        
        .document-content {
          /* Reset browser defaults */
          margin: 0;
          padding: 0;
        }
        
        .document-content p {
          margin: 6pt 0;
          text-align: left;
          font-family: "Times New Roman", "Times", serif;
          font-size: 12pt;
          line-height: 1.15;
        }
        
        .document-content h1,
        .document-content h2,
        .document-content h3,
        .document-content h4,
        .document-content h5,
        .document-content h6 {
          font-family: "Times New Roman", "Times", serif;
          font-weight: bold;
          margin: 12pt 0 6pt 0;
          page-break-after: avoid;
        }
        
        .document-content h1 {
          font-size: 16pt;
        }
        
        .document-content h2 {
          font-size: 14pt;
        }
        
        .document-content h3 {
          font-size: 13pt;
        }
        
        .document-content table {
          border-collapse: collapse;
          width: 100%;
          margin: 12pt 0;
          border: 1pt solid #000000;
        }
        
        .document-content table td,
        .document-content table th {
          border: 1pt solid #000000;
          padding: 4pt 6pt;
          vertical-align: top;
          font-family: "Times New Roman", "Times", serif;
          font-size: 12pt;
        }
        
        .document-content table th {
          font-weight: bold;
          background-color: #f0f0f0;
        }
        
        .document-content ul,
        .document-content ol {
          margin: 6pt 0;
          padding-left: 0.5in;
        }
        
        .document-content li {
          margin: 3pt 0;
          font-family: "Times New Roman", "Times", serif;
          font-size: 12pt;
        }
        
        .document-content img {
          max-width: 100%;
          height: auto;
          margin: 6pt 0;
        }
        
        .document-content strong,
        .document-content b {
          font-weight: bold;
        }
        
        .document-content em,
        .document-content i {
          font-style: italic;
        }
        
        .document-content u {
          text-decoration: underline;
        }
        
        /* Print styles */
        @media print {
          body {
            margin: 0;
            padding: 0;
            background: white;
          }
          
          .document-preview {
            width: 100%;
            min-height: 100vh;
            padding: 0;
            margin: 0;
            box-shadow: none;
            background: white;
          }
          
          header,
          .bg-gray-50,
          button {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}




