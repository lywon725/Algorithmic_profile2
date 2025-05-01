import { fetchVideoInfo } from './videoInfo';
import { OpenAILogger } from './init-logger';

// Define types for JSON watch history
interface JSONWatchHistoryItem {
  titleUrl?: string;
  title: string;
  time: string;
  subtitles?: Array<{ name: string }>;
  header?: string;
}

interface ProcessedWatchHistoryItem {
  videoId: string;
  title: string;
  channel: string;
  date: Date;
  keywords: string[];
  tags: string[];
  timestamp: string;
}

// Function to parse JSON watch history
export const parseJSONWatchHistory = async (
  file: File,
  dateRange?: { from: Date | undefined; to: Date | undefined },
  maxVideosPerDay: number = 5,
  onProgress?: (current: number, total: number) => void
): Promise<ProcessedWatchHistoryItem[]> => {
  try {
    console.log('Starting JSON watch history parsing...');
    
    const text = await file.text();
    const data = JSON.parse(text);
    
    if (!data || !Array.isArray(data)) {
      throw new Error('Invalid JSON format: Expected an array');
    }

    console.log(`Found ${data.length} items in JSON file`);

    // Extract and validate required fields
    const watchItems = data
      .map((item: JSONWatchHistoryItem) => {
        // Skip survey items and other non-video content
        if (item.header === 'YouTube' && item.title === 'Answered survey question') {
          return null;
        }

        // Skip items without titleUrl
        if (!item.titleUrl) {
          return null;
        }

        // Skip non-YouTube URLs
        if (!item.titleUrl.includes('youtube.com/watch')) {
          return null;
        }

        // Extract video ID from titleUrl
        const videoIdMatch = item.titleUrl.match(/v=([^&]+)/);
        if (!videoIdMatch) {
          return null;
        }

        const videoId = videoIdMatch[1];
        if (!videoId) {
          return null;
        }

        const date = new Date(item.time);
        
        return {
          videoId,
          title: item.title,
          channel: item.subtitles?.[0]?.name || 'Unknown Channel',
          date,
          keywords: [], // Initialize empty keywords array
          tags: [] // Initialize empty tags array
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    console.log(`Processed ${watchItems.length} valid items`);

    // Apply date range filtering if specified
    let filteredItems = watchItems;
    if (dateRange?.from && dateRange?.to) {
      filteredItems = watchItems.filter(item => 
        item.date >= dateRange.from! && item.date <= dateRange.to!
      );
      console.log(`Filtered to ${filteredItems.length} items within date range`);
    }

    // Group by date and limit videos per day
    const groupedByDate = filteredItems.reduce((acc, item) => {
      const dateStr = item.date.toISOString().split('T')[0];
      if (!acc[dateStr]) {
        acc[dateStr] = [];
      }
      if (acc[dateStr].length < maxVideosPerDay) {
        acc[dateStr].push(item);
      }
      return acc;
    }, {} as Record<string, typeof filteredItems>);

    const selectedItems = Object.values(groupedByDate).flat();
    console.log(`Selected ${selectedItems.length} items after grouping and limiting`);

    // Process videos in batches to fetch additional info
    const processedItems: ProcessedWatchHistoryItem[] = [];
    let processedCount = 0;
    const totalItems = selectedItems.length;

    // Update progress at the start
    if (onProgress) {
      onProgress(0, totalItems);
    }

    for (const item of selectedItems) {
      try {
        const success = await fetchVideoInfo(item.videoId);
        if (success) {
          processedItems.push({
            videoId: item.videoId,
            title: item.title,
            channel: item.channel,
            date: item.date,
            keywords: [], // Will be populated by fetchVideoInfo
            tags: [], // Will be populated by fetchVideoInfo
            timestamp: new Date().toISOString()
          });
        }
        processedCount++;
        
        // Update progress after each item
        if (onProgress) {
          onProgress(processedCount, totalItems);
        }
      } catch (error) {
        console.error(`Failed to process video ${item.videoId}:`, error);
        processedCount++;
        if (onProgress) {
          onProgress(processedCount, totalItems);
        }
      }
    }

    console.log(`Successfully processed ${processedItems.length} items`);

    // Save to localStorage
    localStorage.setItem('watchHistory', JSON.stringify(processedItems));

    return processedItems;
  } catch (error) {
    console.error('Error parsing JSON watch history:', error);
    throw error;
  }
}; 