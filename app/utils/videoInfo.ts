import OpenAI from 'openai';
import { OpenAILogger } from './init-logger';

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

// 키워드 추출 함수
const extractVideoKeywords = async (videoInfo: any) => {
  try {
    console.log('Starting keyword extraction for video:', {
      title: videoInfo.title,
      description: videoInfo.description?.slice(0, 100),
      tags: videoInfo.tags
    });

    const prompt = `
당신은 YouTube 영상 콘텐츠 분석 전문가입니다. 
다음 영상의 정보를 분석하여 가장 적절한 키워드를 추출해주세요.

[입력 정보]
제목: ${videoInfo.title}
설명: ${videoInfo.description?.slice(0, 200)}
태그: ${videoInfo.tags ? videoInfo.tags.join(', ') : '없음'}

[추출 기준]
1. 주제 관련성: 영상의 핵심 주제를 대표하는 명사 키워드
2. 콘텐츠 유형: 영상의 형식이나 장르를 나타내는 명사 키워드
3. 감정/톤: 영상의 분위기나 감정을 나타내는 형용사 키워드
4. 대상 시청자: 주요 타겟 시청자층을 나타내는 명사 키워드
5. 트렌드/이슈: 관련된 시의성 있는명사 키워드

[요구사항]
- 정확히 5개의 키워드 추출
- 각 키워드는 1-2단어의 한글로 작성
- 너무 일반적이거나 모호한 단어 제외
- 위의 5가지 기준 중 최소 3가지 이상 포함
- 키워드 간의 중복성 최소화

응답 형식: 키워드1, 키워드2, 키워드3, 키워드4, 키워드5

각 키워드 뒤에 해당하는 기준 카테고리를 괄호 안에 표시해주세요.
예시: 브이로그(콘텐츠 유형), 일상(주제 관련성), 힐링(감정/톤)`;

    console.log('Sending request to OpenAI for keyword extraction...');
    
    // Log request
    await OpenAILogger.logRequest({
      model: "gpt-4o-mini",
      temperature: 0.7,
      prompt: prompt
    });

    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "gpt-4o-mini",
      temperature: 0.7,
    });

    console.log('Received response from OpenAI:', {
      model: completion.model,
      usage: completion.usage,
      contentLength: completion.choices[0].message.content?.length
    });

    // Log response
    await OpenAILogger.logResponse({
      model: completion.model,
      content: completion.choices[0].message.content || '',
      usage: completion.usage
    });

    const response = completion.choices[0].message.content?.trim() || '';
    console.log('Raw response:', response);

    if (!response) {
      console.error('Empty response from OpenAI');
      return [];
    }

    const keywords = response.split(',').map(k => {
      const [keyword, category] = k.trim().split('(');
      return {
        keyword: keyword.trim(),
        category: category?.replace(')', '').trim()
      };
    }).filter(k => k.keyword && k.category);

    console.log('Extracted keywords:', keywords);

    if (keywords.length === 0) {
      console.error('No valid keywords extracted');
      return [];
    }

    return keywords;
  } catch (error) {
    console.error('Error in extractVideoKeywords:', error);
    return [];
  }
};

// 비디오 정보 가져오기 함수
export async function fetchVideoInfo(videoId: string): Promise<boolean> {
  try {
    console.log('Fetching video info for:', videoId);
    
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${process.env.NEXT_PUBLIC_YOUTUBE_API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error('YouTube API 요청 실패');
    }

    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      const videoInfo = data.items[0].snippet;
      console.log('Retrieved video info:', {
        title: videoInfo.title,
        hasDescription: !!videoInfo.description,
        tagCount: videoInfo.tags?.length || 0
      });

      try {
        // OpenAI로 키워드 추출 시도
        const extractedKeywords = await extractVideoKeywords(videoInfo);
        console.log('Extracted keywords:', extractedKeywords);

        if (!extractedKeywords || extractedKeywords.length === 0) {
          console.warn('No keywords extracted, using tags as fallback');
          // 실패 시 기본 태그 저장
          const watchHistory = JSON.parse(localStorage.getItem('watchHistory') || '[]');
          const newItem = {
            videoId,
            title: videoInfo.title,
            tags: videoInfo.tags || [],
            keywords: videoInfo.tags ? videoInfo.tags.slice(0, 5) : [],
            timestamp: new Date().toISOString()
          };
          watchHistory.push(newItem);
          localStorage.setItem('watchHistory', JSON.stringify(watchHistory));
          return true;
        }

        // 로컬 스토리지에 저장
        const currentHistory = JSON.parse(localStorage.getItem('watchHistory') || '[]');
        const newItem = {
          videoId,
          title: videoInfo.title,
          tags: videoInfo.tags || [],
          keywords: extractedKeywords.map(k => k.keyword),
          timestamp: new Date().toISOString()
        };
        
        console.log('Saving to watch history:', {
          videoId,
          title: videoInfo.title,
          keywordCount: extractedKeywords.length
        });
        
        const updatedHistory = [...currentHistory, newItem];
        localStorage.setItem('watchHistory', JSON.stringify(updatedHistory));

        return true;
      } catch (error) {
        console.error('키워드 추출 실패:', error);
        // 실패 시 기본 태그 저장
        const watchHistory = JSON.parse(localStorage.getItem('watchHistory') || '[]');
        const newItem = {
          videoId,
          title: videoInfo.title,
          tags: videoInfo.tags || [],
          keywords: videoInfo.tags ? videoInfo.tags.slice(0, 5) : [],
          timestamp: new Date().toISOString()
        };
        watchHistory.push(newItem);
        localStorage.setItem('watchHistory', JSON.stringify(watchHistory));
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('비디오 정보 가져오기 실패:', error);
    throw error;
  }
}

function extractKeywords(text: string): string[] {
  // Remove special characters and convert to lowercase
  const cleanText = text.replace(/[^\w\s]/g, '').toLowerCase();
  
  // Split into words and remove common words
  const words = cleanText.split(/\s+/);
  const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
  
  return words
    .filter(word => word.length > 2 && !commonWords.has(word))
    .map(word => word.trim());
} 