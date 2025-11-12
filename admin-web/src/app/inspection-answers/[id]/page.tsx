'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { authUtils, User } from '@/lib/auth';
import { apiService } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import mammoth from 'mammoth';

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
  const [sectionImages, setSectionImages] = useState<{ [key: string]: any[] }>({});
  const [answerId, setAnswerId] = useState<string | null>(null);
  const [imageLoadingErrors, setImageLoadingErrors] = useState<{ [key: string]: string }>({});
  const router = useRouter();
  
  // Resolve params - in Next.js 15, params is a Promise for both server and client components
  // use() hook unwraps the Promise
  const resolvedParams = use(params);
  
  // Resolve answerId from params or URL
  useEffect(() => {
    let id = resolvedParams?.id;
    
    // Fallback: get from URL if params doesn't have id
    if (!id && typeof window !== 'undefined') {
      const pathParts = window.location.pathname.split('/');
      id = pathParts[pathParts.length - 1];
    }
    
    if (id) {
      setAnswerId(id);
    } else {
      setError('Үзлэгийн ID олдсонгүй');
      setIsLoading(false);
    }
  }, [resolvedParams?.id]);

  useEffect(() => {
    const initializePage = async () => {
      if (!answerId) return; // Wait for answerId to be resolved
      
      try {
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
        await loadInspectionAnswer(answerId);
      } catch (err: any) {
        console.error('Error initializing page:', err);
        setError('Хуудсыг ачаалахад алдаа гарлаа');
        setIsLoading(false);
      }
    };

    initializePage();
  }, [router, answerId]);

  const loadInspectionAnswer = async (id: string) => {
    try {
      setIsLoading(true);
      setError('');
      const response = await apiService.inspectionAnswers.getById(id);
      setAnswer(response.data);
      // Load template after answer is loaded
      await loadTemplateWithData(id);
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
    // Supports nested paths like {d.data.exterior.platform.status}
    // Also handles spaces like {d. metadata.field}
    const placeholderPattern = /\{([a-zA-Z_][a-zA-Z0-9_\.\s]*[a-zA-Z0-9_]+)\}/g;
    
    processedHtml = processedHtml.replace(placeholderPattern, (match, placeholder) => {
      // Remove spaces and normalize the placeholder
      const normalizedPlaceholder = placeholder.replace(/\s+/g, '');
      
      // Handle different Carbone formats
      // {d.field} -> looks in d.field, then data.field
      // {data.field} -> looks in data.field
      // {field} -> looks in data.field, then root.field
      
      let value = undefined;
      
      if (normalizedPlaceholder.startsWith('d.')) {
        // Carbone format: {d.xxx} or {d. metadata.inspector}
        const pathWithoutD = normalizedPlaceholder.substring(2); // Remove 'd.' prefix
        
        // Try multiple path variations for metadata support
        const paths = [
          normalizedPlaceholder,              // d.metadata.inspector (full path)
          `metadata.${pathWithoutD.replace(/^metadata\./, '')}`, // metadata.inspector
          `data.${pathWithoutD}`,  // data.metadata.inspector
          pathWithoutD,            // metadata.inspector (direct)
          `d.data.${pathWithoutD.replace(/^data\./, '')}`, // if starts with data., remove duplicate
          `d.metadata.${pathWithoutD.replace(/^metadata\./, '')}`, // d.metadata.inspector (explicit)
          `data.metadata.${pathWithoutD.replace(/^metadata\./, '')}`, // data.metadata.inspector
          // For metadata fields directly accessed
          pathWithoutD.replace(/^metadata\./, ''), // inspector (if at root)
        ];
        
        for (const path of paths) {
          value = getNestedValue(dataMap, path);
          if (value !== undefined && value !== null) {
            console.log(`Found value for ${normalizedPlaceholder} at path: ${path}`, value);
            break;
          }
        }
        
        if (value === undefined || value === null) {
          console.log(`Could not find value for ${normalizedPlaceholder}, tried paths:`, paths);
        }
      } else if (normalizedPlaceholder.startsWith('data.')) {
        // Direct data path: {data.xxx}
        const paths = [
          normalizedPlaceholder, // data.date
          normalizedPlaceholder.replace('data.', 'metadata.'), // metadata.date (alternative)
        ];
        for (const path of paths) {
          value = getNestedValue(dataMap, path);
          if (value !== undefined && value !== null) break;
        }
      } else if (normalizedPlaceholder.startsWith('metadata.')) {
        // Direct metadata path: {metadata.date}
        const metadataField = normalizedPlaceholder.replace('metadata.', '');
        const paths = [
          normalizedPlaceholder, // metadata.date
          normalizedPlaceholder.replace('metadata.', 'data.'), // data.date (if merged)
          metadataField, // date (if at root level)
          `data.${normalizedPlaceholder}`, // data.metadata.date
          `d.data.${normalizedPlaceholder}`, // d.data.metadata.date
          `d.metadata.${metadataField}`, // d.metadata.date
          `metadata.${metadataField}`, // metadata.date (alternative)
        ];
        for (const path of paths) {
          value = getNestedValue(dataMap, path);
          if (value !== undefined && value !== null) {
            console.log(`Found metadata value for ${normalizedPlaceholder} at path: ${path}`, value);
            break;
          }
        }
      } else {
        // Simple field: {field} - could be metadata field like {date}
        const paths = [
          `data.${normalizedPlaceholder}`, // data.date (metadata merged into data)
          `metadata.${normalizedPlaceholder}`, // metadata.date
          normalizedPlaceholder, // date (at root level)
          `d.data.${normalizedPlaceholder}`, // d.data.date
          `d.metadata.${normalizedPlaceholder}`, // d.metadata.date
        ];
        
        for (const path of paths) {
          value = getNestedValue(dataMap, path);
          if (value !== undefined && value !== null) break;
        }
      }
      
      // Format the value
      if (value !== undefined && value !== null) {
        if (typeof value === 'object' && value !== null) {
          // For objects, try to extract meaningful values
          if (value.status !== undefined) {
            return String(value.status);
          }
          if (value.comment !== undefined) {
            return String(value.comment);
          }
          if (value.answer !== undefined) {
            return String(value.answer);
          }
          // Otherwise stringify
          return JSON.stringify(value);
        }
        return String(value);
      }
      
      // If not found, return empty string instead of placeholder (so it doesn't clutter)
      return '';
    });
    
    return processedHtml;
  };

  const loadTemplateWithData = async (answerId: string) => {
    try {
      setError('');
      
      // Get inspection answer with data
      const answerResponse = await apiService.inspectionAnswers.getById(answerId);
      const answer = answerResponse.data || answerResponse;
      const answerJson = answer?.answers || answer?.data || {};
      
      // Extract metadata (can be at root level or inside data)
      const metadata = answerJson.metadata || answerJson.data?.metadata || {};
      
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
      // This allows {d.data.date} to work when date is in metadata
      const dataWithMetadata = { ...actualData };
      if (metadata && Object.keys(metadata).length > 0) {
        // Merge metadata fields into data object
        Object.assign(dataWithMetadata, metadata);
        // Also keep metadata as nested object
        dataWithMetadata.metadata = metadata;
      }
      
      // Create data map compatible with Carbone format
      const dataMap = {
        // Direct answers data
        ...answerJson,
        data: dataWithMetadata,
        
        // Include metadata at multiple levels for flexibility
        metadata: metadata,
        
        // Add metadata fields directly to root level for {metadata.field} access
        ...(metadata && Object.keys(metadata).length > 0 ? metadata : {}),
        
        // Inspection data
        inspection: {
          id: inspection?.id?.toString() || '',
          title: inspection?.title || '',
          type: inspection?.type || '',
          status: inspection?.status || '',
        },
        
        // Device data
        device: {
          serialNumber: device?.serialNumber || '',
          assetTag: device?.assetTag || '',
          model: device?.model ? {
            manufacturer: device.model.manufacturer || '',
            model: device.model.model || ''
          } : null,
        },
        
        // Contractor/Organization data (Carbone style)
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
        
        // User data
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
        
        // Legacy Carbone paths for backward compatibility
        d: {
          contractor: {
            company: organization?.name || '',
          },
          device: {
            serialNumber: device?.serialNumber || '',
            assetTag: device?.assetTag || '',
          },
          data: dataWithMetadata, // Already includes metadata fields
          metadata: metadata, // Nested metadata object
        },
      };
      
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
      const populatedHtml = replacePlaceholders(result.value, dataMap);
      
      // Load images for each section first
      const loadedImages = await loadSectionImages(answerId);
      
      // Split HTML by sections and add section info/images after each section
      const sectionsHtml = splitHtmlBySections(populatedHtml, loadedImages);
      setHtmlContent(sectionsHtml);
      
      // Log any warnings
      if (result.messages.length > 0) {
        console.warn('Conversion warnings:', result.messages);
      }
    } catch (err: any) {
      console.error('Failed to load template:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Баримт файл ачаалахад алдаа гарлаа';
      setError(errorMessage);
      setHtmlContent(''); // Clear content on error
    }
  };

  // Split HTML by sections and add section info/images after each section table
  const splitHtmlBySections = (html: string, imagesBySection: { [key: string]: any[] } = {}): string => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔧 splitHtmlBySections called`);
    console.log(`HTML length: ${html.length}`);
    console.log(`Images by section:`, Object.keys(imagesBySection).map(key => ({ section: key, count: imagesBySection[key].length })));
    console.log(`${'='.repeat(60)}`);
    
    const sections = [
      { key: 'exterior', name: 'Гадаад хэсэг', order: 1 },
      { key: 'indicator', name: 'Индикаторын хэсэг', order: 2 },
      { key: 'jbox', name: 'Хайрцагны хэсэг', order: 3 },
      { key: 'sensor', name: 'Мэдрэгчийн хэсэг', order: 4 },
      { key: 'foundation', name: 'Суурийн хэсэг', order: 5 },
      { key: 'cleanliness', name: 'Цэвэрлэгээний хэсэг', order: 6 }
    ];

    let result = html;
    
    // Find section headers and add markers after each section's table
    // IMPORTANT: We need to find the CORRECT section header, not just the first match
    // Section headers should be in their own dedicated table, not in other tables
    sections.forEach((section, index) => {
      // Find the next section's header to know where current section ends
      const nextSectionOrder = index < sections.length - 1 ? sections[index + 1].order : 999;
      const nextSectionPattern = new RegExp(`Section\\s*${nextSectionOrder}[^<]*`, 'i');
      
      // Find all section headers with their positions
      // We need to find the header that is actually for THIS section
      const sectionHeaderPatterns = [
        new RegExp(`Section\\s*${section.order}(?![0-9])[^<]*`, 'i'), // Section 1 (not Section 10)
        new RegExp(`Section${section.order}(?![0-9])[^<]*`, 'i'), // Section1 (not Section10)
      ];

      // Find all table endings and check if they belong to this section
      let lastTableEndIndex = -1;
      const tableMatches: Array<{ index: number; match: string; startIndex?: number }> = [];
      
      // Find all <table> and </table> tags to understand table structure
      const tableStartRegex = /<table[^>]*>/gi;
      const tableEndRegex = /<\/table>/g;
      let match;
      
      // Find all table starts
      const tableStarts: Array<{ index: number; match: string }> = [];
      while ((match = tableStartRegex.exec(result)) !== null) {
        tableStarts.push({ index: match.index, match: match[0] });
      }
      
      // Find all table ends
      while ((match = tableEndRegex.exec(result)) !== null) {
        tableMatches.push({ index: match.index, match: match[0] });
      }
      
      // Match table starts with table ends
      tableMatches.forEach((tableEnd, i) => {
        // Find the corresponding table start (the last <table> before this </table>)
        for (let j = tableStarts.length - 1; j >= 0; j--) {
          if (tableStarts[j].index < tableEnd.index) {
            tableEnd.startIndex = tableStarts[j].index;
            break;
          }
        }
      });

      // Find section header position - but only if it's inside a table that belongs to this section
      // Strategy: Find all potential section headers, then find the one that's in the correct table
      let sectionHeaderIndex = -1;
      let sectionTableIndex = -1;
      let matchedPattern = '';
      
      // Find all potential section headers
      const allHeaderMatches: Array<{ index: number; pattern: string }> = [];
      for (const pattern of sectionHeaderPatterns) {
        let match;
        const regex = new RegExp(pattern.source, 'gi');
        while ((match = regex.exec(result)) !== null) {
          allHeaderMatches.push({ index: match.index, pattern: pattern.toString() });
        }
      }
      
      // Find the next section header position to know where this section ends
      const nextSectionMatch = result.search(nextSectionPattern);
      const sectionEndIndex = nextSectionMatch !== -1 ? nextSectionMatch : result.length;
      
      // Find which table contains this section's header
      // We want the table that:
      // 1. Contains the section header
      // 2. Is before the next section starts
      // 3. Is the correct section's table (not a metadata/general info table)
      for (let i = 0; i < allHeaderMatches.length; i++) {
        const headerMatch = allHeaderMatches[i];
        
        // Check if this header is before the section end
        if (headerMatch.index >= sectionEndIndex) continue;
        
        // Find which table contains this header
        for (let j = 0; j < tableMatches.length; j++) {
          const tableEnd = tableMatches[j];
          const tableStart = tableEnd.startIndex;
          
          if (tableStart !== undefined && 
              headerMatch.index >= tableStart && 
              headerMatch.index < tableEnd.index &&
              tableEnd.index < sectionEndIndex) {
            
            // This is a potential match - check if it's the right one
            // We want the table that's specifically for this section
            // Check if the table content contains section-specific content
            const tableContent = result.substring(tableStart, tableEnd.index);
            const hasSectionName = tableContent.includes(section.name) || 
                                  tableContent.includes(`Section${section.order}`) ||
                                  tableContent.includes(`Section ${section.order}`);
            
            if (hasSectionName || sectionHeaderIndex === -1) {
              // This looks like the right table
              sectionHeaderIndex = headerMatch.index;
              sectionTableIndex = j;
              matchedPattern = headerMatch.pattern;
              
              // If we found a table with section name, use it and break
              if (hasSectionName) {
                break;
              }
            }
          }
        }
        
        // If we found a good match with section name, break
        if (sectionHeaderIndex !== -1 && sectionTableIndex !== -1) {
          const tableContent = result.substring(tableMatches[sectionTableIndex].startIndex!, tableMatches[sectionTableIndex].index);
          if (tableContent.includes(section.name) || tableContent.includes(`Section${section.order}`)) {
            break;
          }
        }
      }

      console.log(`Section ${section.order} (${section.key}):`, {
        sectionHeaderFound: sectionHeaderIndex !== -1,
        sectionHeaderIndex,
        sectionTableIndex,
        matchedPattern: matchedPattern.substring(0, 50),
        totalTables: tableMatches.length,
        sectionEndIndex
      });

      // Find the last table before next section starts
      if (sectionTableIndex !== -1) {
        // Use the table we found that contains the section header
        lastTableEndIndex = tableMatches[sectionTableIndex].index + tableMatches[sectionTableIndex].match.length;
        console.log(`  Section ${section.order}: Using table ${sectionTableIndex + 1} that contains section header, ending at ${lastTableEndIndex}`);
      } else if (sectionHeaderIndex !== -1) {
        // Fallback: Find the last table that ends before next section
        for (let i = tableMatches.length - 1; i >= 0; i--) {
          const tableEndIndex = tableMatches[i].index + tableMatches[i].match.length;
          if (tableEndIndex > sectionHeaderIndex && tableEndIndex < sectionEndIndex) {
            lastTableEndIndex = tableEndIndex;
            console.log(`  Section ${section.order}: Found table ${i + 1} ending at ${tableEndIndex} (fallback)`);
            break;
          }
        }
      } else {
        // If can't find header, try to find by table order (assume each section has one table)
        // But skip the first few tables which might be metadata tables
        const skipTables = 2; // Skip first 2 tables (contract info, general info)
        const tableIndex = skipTables + index;
        if (tableMatches[tableIndex]) {
          lastTableEndIndex = tableMatches[tableIndex].index + tableMatches[tableIndex].match.length;
          console.log(`  Section ${section.order}: Using table by adjusted index (${tableIndex}) at ${lastTableEndIndex}`);
        } else {
          console.warn(`  Section ${section.order}: No table found at adjusted index ${tableIndex}`);
        }
      }
      
      // Debug: Show HTML context around placeholder position
      if (lastTableEndIndex !== -1) {
        const contextStart = Math.max(0, lastTableEndIndex - 100);
        const contextEnd = Math.min(result.length, lastTableEndIndex + 100);
        const context = result.substring(contextStart, contextEnd);
        console.log(`  Section ${section.order}: HTML context around placeholder:`, {
          before: context.substring(0, 100),
          after: context.substring(context.length - 100)
        });
      }

      // Add placeholder after the last table of this section
      if (lastTableEndIndex !== -1) {
        // Check if there's already content right after the table (like paragraphs, breaks, etc.)
        // We want to insert after the table, but before any following content
        const afterTableContent = result.substring(lastTableEndIndex, Math.min(lastTableEndIndex + 200, result.length));
        
        // Check if there's already a placeholder or section content
        const hasExistingContent = /<p[^>]*>|<\/p>|<br|<div|<h[1-6]/.test(afterTableContent);
        
        // Find the best position: right after </table> or after any immediate whitespace/newlines
        let insertPosition = lastTableEndIndex;
        
        // Skip whitespace and newlines after </table>
        const whitespaceMatch = afterTableContent.match(/^[\s\n\r]*/);
        if (whitespaceMatch) {
          insertPosition += whitespaceMatch[0].length;
        }
        
        const beforeTable = result.substring(0, insertPosition);
        const afterTable = result.substring(insertPosition);
        result = beforeTable + `<!-- SECTION-${section.order}-END -->` + afterTable;
        
        console.log(`✅ Section ${section.order} (${section.key}): Placeholder added at index ${insertPosition} (after table at ${lastTableEndIndex})`);
        console.log(`  After table content preview: ${afterTableContent.substring(0, 150)}...`);
      } else {
        console.warn(`⚠️ Section ${section.order} (${section.key}): Could not find table end position, placeholder not added`);
      }
    });

    // Now replace placeholders with actual section info and images HTML
    console.log(`\n🔄 Replacing placeholders with section HTML...`);
    sections.forEach((section) => {
      const placeholder = `<!-- SECTION-${section.order}-END -->`;
      const hasPlaceholder = result.includes(placeholder);
      
      console.log(`Section ${section.order} (${section.key}):`, {
        hasPlaceholder,
        imagesCount: imagesBySection[section.key]?.length || 0
      });
      
      if (hasPlaceholder) {
        try {
          const sectionInfoHtml = generateSectionInfoHtml(section, imagesBySection);
          console.log(`✅ Section ${section.order} (${section.key}): Generated HTML (length: ${sectionInfoHtml.length})`);
          result = result.replace(placeholder, sectionInfoHtml);
        } catch (err: any) {
          console.error(`❌ Section ${section.order} (${section.key}): Error generating HTML:`, err);
          // Replace with error message instead of crashing
          result = result.replace(placeholder, `<div style="color: red; padding: 10px;">Error generating section HTML: ${err.message}</div>`);
        }
      } else {
        console.warn(`⚠️ Section ${section.order} (${section.key}): Placeholder not found in HTML`);
      }
    });
    
    console.log(`✅ splitHtmlBySections completed`);
    console.log(`${'='.repeat(60)}\n`);

    return result;
  };

  // Generate HTML for section info and images
  const generateSectionInfoHtml = (section: { key: string; name: string; order: number }, imagesBySection: { [key: string]: any[] } = {}): string => {
    console.log(`\n🔨 generateSectionInfoHtml called for Section ${section.order} (${section.key})`);
    console.log(`Has answer: ${!!answer}`);
    console.log(`Images count: ${imagesBySection[section.key]?.length || 0}`);
    
    // Get section data from answer if available, but don't return empty if answer is missing
    // We still want to render images even if answer data is not available
    let sectionData = null;
    if (answer) {
      try {
        const answerData = answer?.answers || {};
        const data = typeof answerData === 'string' ? JSON.parse(answerData) : answerData;
        const actualData = data?.data || data;
        sectionData = actualData?.[section.key];
        console.log(`Section data found: ${!!sectionData}`);
      } catch (err) {
        console.warn(`Error parsing answer data:`, err);
      }
    }
    
    const images = imagesBySection[section.key] || [];
    console.log(`Images for rendering: ${images.length}`);

    let html = '';

    // Section Information - only show if sectionData exists and has content
    if (sectionData && Object.keys(sectionData).length > 0) {
      // Check if there's any meaningful data to display
      const hasValidData = Object.values(sectionData).some((value: any) => 
        typeof value === 'object' && value !== null && value.status
      );
      
      if (hasValidData) {
        html += `<div style="margin-top: 20px; margin-bottom: 20px; padding: 15px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">`;
        html += `<h3 style="font-size: 14pt; font-weight: bold; margin-bottom: 10px;">Section${section.order} - ${section.name}</h3>`;
        html += `<div style="margin-top: 10px;">`;
        Object.entries(sectionData).forEach(([field, value]: [string, any]) => {
          if (typeof value === 'object' && value !== null && value.status) {
            const statusColor = (value.status === 'Зүгээр' || value.status === 'Цэвэр' || value.status === 'Саадгүй' || value.status === 'Бүтэн') 
              ? '#10b981' : '#ef4444';
            html += `<div style="margin-bottom: 8px; padding: 8px; background-color: white; border-radius: 4px;">`;
            html += `<p style="margin: 0; font-weight: 500; font-size: 11pt;">${value.question || field.replace('_', ' ')}</p>`;
            if (value.comment) {
              html += `<p style="margin: 4px 0 0 0; font-size: 10pt; color: #6b7280;">Тайлбар: ${value.comment}</p>`;
            }
            html += `<span style="display: inline-block; margin-top: 4px; padding: 2px 8px; background-color: ${statusColor === '#10b981' ? '#d1fae5' : '#fee2e2'}; color: ${statusColor}; border-radius: 12px; font-size: 9pt;">${value.status}</span>`;
            html += `</div>`;
          }
        });
        html += `</div>`;
        html += `</div>`;
      }
    }
    // If no section data, don't show the "Энэ хэсэгт мэдээлэл байхгүй байна" message

    // Section Images - only show if there are images
    const imagesWithUrl = images.filter((img: any) => img.imageUrl);
    const imagesWithoutUrl = images.filter((img: any) => !img.imageUrl);
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📸 Generating HTML for Section ${section.order} (${section.key}): ${section.name}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Total images: ${images.length}`);
    console.log(`Images with imageUrl: ${imagesWithUrl.length}`);
    console.log(`Images without imageUrl: ${imagesWithoutUrl.length}`);
    
    // Only show images section if there are images with valid URLs
    if (imagesWithUrl.length > 0) {
      html += `<div style="margin-top: 20px; margin-bottom: 20px; padding: 15px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">`;
      html += `<h3 style="font-size: 14pt; font-weight: bold; margin-bottom: 10px;">Section${section.order} - ${section.name} - Зураг</h3>`;
      
      if (imagesWithoutUrl.length > 0) {
        console.warn(`⚠️ ${imagesWithoutUrl.length} image(s) without imageUrl:`, imagesWithoutUrl.map((img: any, idx: number) => ({
          index: idx,
          hasImageData: !!img.imageData,
          imageDataLength: img.imageData?.length || 0,
          hasImageUrl: !!img.imageUrl,
          mimeType: img.mimeType
        })));
      }
      
      imagesWithUrl.forEach((img: any, idx: number) => {
        console.log(`\nImage ${idx + 1}:`, {
          hasImageUrl: !!img.imageUrl,
          imageUrlLength: img.imageUrl?.length || 0,
          imageUrlStartsWithData: img.imageUrl?.startsWith('data:'),
          imageUrlHasComma: img.imageUrl?.includes(','),
          imageUrlPreview: img.imageUrl ? img.imageUrl.substring(0, 80) + '...' : 'N/A',
          mimeType: img.mimeType,
          hasImageData: !!img.imageData,
          imageDataLength: img.imageData?.length || 0
        });
      });
      
      // Render images grouped by fieldId (question)
      console.log(`\n✅ Section ${section.order}: Ready to render ${imagesWithUrl.length} image(s)`);
      
      // Group images by fieldId
      const imagesByField: { [fieldId: string]: any[] } = {};
      imagesWithUrl.forEach((img: any) => {
        const fieldId = img.fieldId || 'unknown';
        if (!imagesByField[fieldId]) {
          imagesByField[fieldId] = [];
        }
        imagesByField[fieldId].push(img);
      });
      
      console.log(`Section ${section.order}: Images grouped by field:`, Object.keys(imagesByField).map(fieldId => ({
        fieldId,
        count: imagesByField[fieldId].length
      })));
      
      // Render images grouped by field
      Object.entries(imagesByField).forEach(([fieldId, fieldImages]) => {
        // Get field name/label from section data if available
        let fieldLabel = fieldId;
        if (sectionData && sectionData[fieldId]) {
          const fieldData = sectionData[fieldId];
          if (typeof fieldData === 'object' && fieldData !== null && fieldData.question) {
            fieldLabel = fieldData.question;
          }
        }
        // Format field label (replace underscores with spaces, capitalize)
        fieldLabel = fieldLabel.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
        
        html += `<div style="margin-bottom: 30px;">`;
        html += `<h4 style="font-size: 12pt; font-weight: 600; margin-bottom: 12px; color: #374151; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb;">${fieldLabel}</h4>`;
        html += `<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">`;
        
        fieldImages.forEach((img: any, imgIndex: number) => {
          // Use imageUrl directly - it's already a data URL or valid URL
          // For data URLs, we need to ensure proper escaping
          const imageSrc = img.imageUrl;
          
          console.log(`Section ${section.order}, Image ${imgIndex + 1}: Using imageUrl:`, {
            length: imageSrc.length,
            startsWithData: imageSrc.startsWith('data:'),
            preview: imageSrc.substring(0, 100),
            isValidLength: imageSrc.length > 100,
            hasBase64Part: imageSrc.includes(',')
          });
          
          // Validate data URL format
          let safeSrc = imageSrc;
          let isValidDataUrl = true;
          
          if (imageSrc.startsWith('data:')) {
            // Validate data URL format: data:[<mediatype>][;base64],<data>
            const parts = imageSrc.split(',');
            if (parts.length !== 2) {
              console.error(`❌ Section ${section.order}, Image ${imgIndex + 1}: Invalid data URL format - missing comma separator`);
              isValidDataUrl = false;
            } else {
              const [header, base64Data] = parts;
              // Validate base64 data
              const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
              if (!base64Regex.test(base64Data)) {
                console.error(`❌ Section ${section.order}, Image ${imgIndex + 1}: Base64 data is not valid!`);
                console.error(`❌ Base64 preview: ${base64Data.substring(0, 100)}...`);
                isValidDataUrl = false;
              } else {
                console.log(`✅ Section ${section.order}, Image ${imgIndex + 1}: Valid data URL format`);
              }
            }
          }
          
          // Escape HTML attributes properly
          // Data URLs can contain special characters that need to be escaped in HTML attributes
          // Use a more robust escaping method
          if (isValidDataUrl) {
            // For HTML attributes, we need to escape:
            // - Quotes (") -> &quot;
            // - But data URLs should not contain quotes in the base64 part
            // JSON.stringify handles all escaping properly, then remove quotes
            try {
              safeSrc = JSON.stringify(imageSrc).slice(1, -1); // Remove surrounding quotes
              console.log(`✅ Section ${section.order}, Image ${imgIndex + 1}: Escaped data URL for HTML (length: ${safeSrc.length})`);
            } catch (escapeErr) {
              console.error(`❌ Section ${section.order}, Image ${imgIndex + 1}: Failed to escape data URL:`, escapeErr);
              // Fallback: basic HTML entity encoding for quotes only
              safeSrc = imageSrc.replace(/"/g, '&quot;');
            }
          }
          
          // Escape section name and alt text for HTML
          const safeAltText = section.name.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
          
          html += `<div style="border: 1px solid #e5e7eb; border-radius: 4px; overflow: hidden; background-color: white; position: relative;">`;
          
          if (isValidDataUrl) {
            // Create img element with proper escaping
            html += `<img 
              src="${safeSrc}" 
              alt="${safeAltText} - Зураг ${imgIndex + 1}" 
              style="width: 100%; height: 200px; object-fit: contain; display: block; background-color: #f3f4f6;" 
              onerror="console.error('❌ Image failed to load for Section ${section.order}, Image ${imgIndex + 1}'); console.error('Error details:', { section: '${section.key}', imageIndex: ${imgIndex}, srcLength: this.src ? this.src.length : 0, srcPreview: this.src ? this.src.substring(0, 100) : 'N/A', errorType: event?.type || 'unknown' }); this.style.border='2px solid red'; this.style.backgroundColor='#fee2e2'; this.alt='Зураг ачааллахад алдаа гарлаа'; this.title='Зураг ачааллахад алдаа гарлаа. Console-ийг шалгана уу.';" 
              onload="console.log('✅ Image loaded successfully for Section ${section.order}, Image ${imgIndex + 1}', { srcLength: this.src.length, naturalWidth: this.naturalWidth, naturalHeight: this.naturalHeight });" 
              loading="lazy"
            />`;
          } else {
            // Show error placeholder if data URL is invalid
            html += `<div style="width: 100%; height: 200px; display: flex; align-items: center; justify-content: center; background-color: #fee2e2; border: 2px solid red; color: #991b1b; font-size: 10pt; text-align: center; padding: 10px;">
              <div>
                <p style="margin: 0; font-weight: bold;">❌ Зураг ачааллахад алдаа</p>
                <p style="margin: 4px 0 0 0; font-size: 8pt;">Data URL формат буруу байна</p>
              </div>
            </div>`;
          }
          
          html += `</div>`;
        });
        html += `</div>`;
        html += `</div>`;
      });
      console.log(`✅ Section ${section.order}: HTML generated for ${imagesWithUrl.length} image(s)`);
      
      // Close the images section div
      html += `</div>`;
    } else {
      // No images - don't show the images section at all
      console.log(`ℹ️ Section ${section.order}: No images found for this section - skipping images section`);
    }
    
    console.log(`✅ Section ${section.order} HTML generated, total length: ${html.length}`);
    console.log(`${'='.repeat(60)}\n`);

    return html;
  };

  const loadSectionImages = async (answerId: string): Promise<{ [key: string]: any[] }> => {
    try {
      const sections = ['exterior', 'indicator', 'jbox', 'sensor', 'foundation', 'cleanliness'];
      const imagesBySection: { [key: string]: any[] } = {};
      const errorsBySection: { [key: string]: string } = {};
      
      for (const section of sections) {
        try {
          console.log(`\n=== Loading images for section: ${section} ===`);
          const response = await apiService.inspectionAnswers.getQuestionImages(answerId, { section });
          console.log(`API Response for ${section}:`, {
            hasData: !!response?.data,
            hasDataData: !!response?.data?.data,
            hasDataImages: !!response?.data?.data?.images,
            hasImages: !!response?.images,
            responseKeys: Object.keys(response || {}),
            dataKeys: response?.data ? Object.keys(response.data) : []
          });
          
          const images = response?.data?.images || response?.data?.data?.images || response?.images || [];
          console.log(`Section ${section}: Found ${images.length} images from API`);
          
          // Log API errors if any
          if (response?.error) {
            console.error(`❌ API Error for section ${section}:`, response.error);
            errorsBySection[section] = response.error;
          }
          
          if (images.length > 0) {
            console.log(`First image structure:`, {
              keys: Object.keys(images[0]),
              hasImageData: !!images[0].imageData,
              imageDataType: typeof images[0].imageData,
              imageDataLength: images[0].imageData?.length || 0,
              imageDataPreview: images[0].imageData?.substring(0, 100) || 'N/A',
              mimeType: images[0].mimeType || images[0].mime_type,
              hasImageUrl: !!images[0].imageUrl,
              hasUrl: !!images[0].url
            });
          }
          
          imagesBySection[section] = images.map((img: any, index: number) => {
            // Debug: Check image data structure
            console.log(`\n[DEBUG] Section ${section}, Image ${index}:`, {
              hasImageData: !!img.imageData,
              imageDataType: typeof img.imageData,
              imageDataLength: img.imageData?.length || 0,
              imageDataPreview: img.imageData ? img.imageData.substring(0, 50) : 'N/A',
              imageDataStartsWith: img.imageData ? img.imageData.substring(0, 10) : 'N/A',
              mimeType: img.mimeType || img.mime_type,
              hasImageUrl: !!img.imageUrl,
              hasUrl: !!img.url,
              allKeys: Object.keys(img)
            });
            
            let imageUrl = null;
            
            // Handle imageData - it should be a base64 string from the backend
            if (img.imageData) {
              let base64String = '';
              
              // If it's already a data URL, use it directly
              if (typeof img.imageData === 'string' && img.imageData.startsWith('data:')) {
                imageUrl = img.imageData;
                console.log(`[DEBUG] Section ${section}, Image ${index}: imageData is already a data URL`);
              } else if (typeof img.imageData === 'string') {
                // Backend should send base64 string (not Buffer in browser)
                // Remove any whitespace/newlines
                base64String = img.imageData.trim().replace(/\s/g, '');
                
                // Validate base64 format (optional check)
                const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
                if (base64Regex.test(base64String)) {
                  console.log(`[DEBUG] Section ${section}, Image ${index}: imageData is valid base64 string, length: ${base64String.length}`);
                } else {
                  console.warn(`[DEBUG] Section ${section}, Image ${index}: imageData might not be valid base64, but attempting to use anyway. Length: ${base64String.length}`);
                  console.warn(`[DEBUG] First 50 chars: ${base64String.substring(0, 50)}`);
                }
                
            // Create data URL
            const mimeType = img.mimeType || img.mime_type || 'image/jpeg';
            
            // Validate base64 string before creating data URL
            if (base64String.length === 0) {
              console.error(`[ERROR] Section ${section}, Image ${index}: Base64 string is empty after trimming!`);
              imageUrl = null;
            } else {
              // Ensure base64 string doesn't have any invalid characters
              // Remove any non-base64 characters that might have been introduced
              const cleanedBase64 = base64String.replace(/[^A-Za-z0-9+/=]/g, '');
              
              if (cleanedBase64.length !== base64String.length) {
                console.warn(`[WARNING] Section ${section}, Image ${index}: Removed ${base64String.length - cleanedBase64.length} invalid characters from base64 string`);
                console.warn(`[WARNING] Original length: ${base64String.length}, Cleaned length: ${cleanedBase64.length}`);
              }
              
              imageUrl = `data:${mimeType};base64,${cleanedBase64}`;
              console.log(`[DEBUG] Section ${section}, Image ${index}: Created data URL`, {
                mimeType,
                dataUrlLength: imageUrl.length,
                base64Length: cleanedBase64.length,
                dataUrlPreview: imageUrl.substring(0, 100) + '...',
                base64Preview: cleanedBase64.substring(0, 50) + '...',
                isValidFormat: imageUrl.startsWith('data:') && imageUrl.includes(',')
              });
            }
          } else {
            console.error(`[ERROR] Section ${section}, Image ${index}: imageData is not a string! Type: ${typeof img.imageData}`, img.imageData);
            // Try to convert to string anyway
            base64String = String(img.imageData).trim();
            const mimeType = img.mimeType || img.mime_type || 'image/jpeg';
            const cleanedBase64 = base64String.replace(/[^A-Za-z0-9+/=]/g, '');
            imageUrl = `data:${mimeType};base64,${cleanedBase64}`;
          }
            } else if (img.imageUrl) {
              imageUrl = img.imageUrl;
              console.log(`[DEBUG] Section ${section}, Image ${index}: Using existing imageUrl`);
            } else if (img.url) {
              imageUrl = img.url;
              console.log(`[DEBUG] Section ${section}, Image ${index}: Using url field`);
            }
            
            if (!imageUrl) {
              console.error(`[ERROR] Section ${section}, Image ${index}: ❌ No imageUrl created! Image object:`, {
                keys: Object.keys(img),
                hasImageData: !!img.imageData,
                hasImageUrl: !!img.imageUrl,
                hasUrl: !!img.url
              });
            } else {
              console.log(`[SUCCESS] Section ${section}, Image ${index}: ✅ imageUrl created`, {
                length: imageUrl.length,
                startsWithData: imageUrl.startsWith('data:'),
                isValidLength: imageUrl.length > 100
              });
            }
            
            return {
              ...img,
              imageUrl
            };
          });
        } catch (err: any) {
          const errorMessage = err.response?.data?.message || err.message || 'Unknown error';
          console.error(`❌ Failed to load images for section ${section}:`, {
            error: errorMessage,
            status: err.response?.status,
            statusText: err.response?.statusText,
            fullError: err
          });
          imagesBySection[section] = [];
          errorsBySection[section] = errorMessage;
        }
      }
      
      // Log summary of errors
      if (Object.keys(errorsBySection).length > 0) {
        console.error('\n❌ ========== IMAGE LOADING ERRORS ==========');
        Object.entries(errorsBySection).forEach(([section, error]) => {
          console.error(`Section ${section}: ${error}`);
        });
        console.error('===========================================\n');
        setImageLoadingErrors(errorsBySection);
      } else {
        setImageLoadingErrors({});
      }
      
      console.log('Loaded images by section:', imagesBySection);
      // Debug: Check if images have imageUrl
      Object.entries(imagesBySection).forEach(([section, images]) => {
        images.forEach((img: any, index: number) => {
          if (img.imageUrl) {
            console.log(`Section ${section}, Image ${index}: imageUrl exists, starts with: ${img.imageUrl.substring(0, 30)}...`);
          } else {
            console.warn(`Section ${section}, Image ${index}: imageUrl is missing!`);
          }
        });
      });
      
      setSectionImages(imagesBySection);
      return imagesBySection;
    } catch (err) {
      console.error('Failed to load section images:', err);
      return {};
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
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <Sidebar currentUser={user} />

      {/* Main Content */}
      <div className="flex-1 ml-64">
        {/* Header */}
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex justify-between items-center">
              <div>
                <button
                  onClick={() => router.push('/inspection-answers')}
                  className="text-indigo-600 hover:text-indigo-800 mb-2 text-sm font-medium"
                >
                  ← Буцах
                </button>
                <h1 className="text-xl font-bold text-gray-900">Үзлэгийн хариулт</h1>
                <p className="text-sm text-gray-500">Үзлэгийн дэлгэрэнгүй мэдээлэл</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{user?.fullName}</p>
                  <p className="text-sm text-gray-500">{user?.organization.name}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="text-red-800">{error}</div>
            <button 
              onClick={() => answerId && loadInspectionAnswer(answerId)}
              className="mt-2 text-red-600 hover:text-red-800 text-sm underline"
            >
              Дахин ачаалах
            </button>
          </div>
        )}

        {/* Inspection Info */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md mb-6">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Үзлэгийн мэдээлэл
            </h3>
            {!answer.inspection && (
              <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-800">
                      Үзлэгийн мэдээлэл бүрэн олдсонгүй. Зөвхөн хариултын мэдээлэл харуулагдаж байна.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Үзлэгийн нэр</dt>
                <dd className="mt-1 text-sm text-gray-900">{answer.inspection?.title || 'Үзлэгийн нэр олдсонгүй'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Төрөл</dt>
                <dd className="mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(answer.inspection?.type || '')}`}>
                    {answer.inspection?.type || 'Төрөл тодорхойгүй'}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Төлөв</dt>
                <dd className="mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(answer.inspection?.status || '')}`}>
                    {answer.inspection?.status || 'Төлөв тодорхойгүй'}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Төхөөрөмж</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {answer.inspection?.device?.serialNumber ? 
                    `${answer.inspection.device.serialNumber} (${answer.inspection.device.assetTag || 'Asset tag олдсонгүй'})` : 
                    'Төхөөрөмжийн мэдээлэл олдсонгүй'
                  }
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Хариуцсан хүн</dt>
                <dd className="mt-1 text-sm text-gray-900">{answer.inspection?.assignee?.fullName || 'Хариуцсан хүн олдсонгүй'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Хариулсан хүн</dt>
                <dd className="mt-1 text-sm text-gray-900">{answer.user?.fullName}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Хариулсан огноо</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(answer.answeredAt).toLocaleDateString('mn-MN')} {new Date(answer.answeredAt).toLocaleTimeString('mn-MN')}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Үүсгэсэн огноо</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(answer.createdAt).toLocaleDateString('mn-MN')} {new Date(answer.createdAt).toLocaleTimeString('mn-MN')}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Image Loading Errors */}
        {Object.keys(imageLoadingErrors).length > 0 && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-red-800 mb-2">
                  Зургийг ачаалахад алдаа гарлаа
                </h3>
                <div className="text-sm text-red-700 space-y-1">
                  {Object.entries(imageLoadingErrors).map(([section, error]) => (
                    <div key={section}>
                      <strong>{section}:</strong> {error}
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-xs text-red-600">
                  <p>• Browser Console (F12) нээгээд дэлгэрэнгүй мэдээллийг шалгана уу</p>
                  <p>• Network tab-д API дуудлагын мэдээллийг шалгана уу</p>
                  <p>• Backend console-ийг шалгана уу</p>
                </div>
              </div>
            </div>
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

        {!htmlContent && !error && (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <div className="px-4 py-5 sm:px-6 text-center">
              <p className="text-gray-500">Баримт ачаалж байна...</p>
            </div>
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
    </div>
  );
}




