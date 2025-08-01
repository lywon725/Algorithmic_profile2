import { ImageData } from '../types/profile';
import { arrangeImagesInCenter } from './autoArrange';
import { saveClusterHistory } from './save/saveClusterHistory'; 
import { saveSliderHistory } from './save/saveSliderHistory'; 
import { saveProfileImages } from './save/saveImageData';
import { saveWatchHistory_array } from './save/saveWatchHistory_array';

// 중앙 위주 좌표 배열 (px 단위)
const centerPositions = [
  { left: '500px', top: '200px' },
  { left: '570px', top: '380px' },
  { left: '380px', top: '420px' },
  { left: '110px', top: '410px' },
  { left: '790px', top: '290px' },
  { left: '30px', top: '400px' },
  { left: '300px', top: '430px' },
  { left: '770px', top: '300px' },
  { left: '200px', top: '170px' }
];

export const transform = (
  cluster: any,
  index: number,
  imageUrl: string,
  minStrength: number,
  maxStrength: number
): ImageData => {
 
  const relatedVideos = cluster.related_videos;
  const keywords = cluster.keyword_list?.split(',').map((k: string) => k.trim()) || [];

  //strength 기반으로 sizeWeight 계산 (동적 min/max)
  const strength = cluster.strength || cluster.metadata?.videoCount || 1;
  let sizeWeight = 0.02; // 기본값
  if (maxStrength > minStrength) {
    // 0.015 ~ 0.03 사이로 정규화
    const ratio = (strength - minStrength) / (maxStrength - minStrength);
    sizeWeight = 0.015 + ratio * (0.03 - 0.01);
  } else {
    // 모든 strength가 동일한 경우 중간값 사용
    sizeWeight = (0.015 + 0.03) / 2; // 0.0275
  }

  //위치

  return {
    id: String(index + 1),
    src: imageUrl,
    main_keyword: cluster.main_keyword,
    mood_keyword: cluster.mood_keyword || '',
    description: cluster.description || '',
    category: cluster.category?.toLowerCase() || 'other',
    keywords: keywords,
    relatedVideos: relatedVideos,
    sizeWeight,

    desired_self: false,
    desired_self_profile: null,

    width: 800,
    height: 800,
    rotate: 0,
    // 위치는 최종 단계에서 할당됨
    left: '0px',
    top: '0px',
    metadata: cluster.metadata || {},

    //추가 
    position: { x: 0, y: 0 },
    frameStyle: 'normal',
    created_at: cluster.created_at || new Date().toISOString()
  };
};

const placeholderImage = '/images/default_image.png';

export function transformClustersToImageData(clusters: any[]): ImageData[] {
  const clusterArray = Array.isArray(clusters) ? clusters : [clusters];

  const strengths = clusterArray.map(c => c.strength || c.metadata?.videoCount || 1);
  const minStrength = Math.min(...strengths);
  const maxStrength = Math.max(...strengths);

  console.log('✅ 받아온 클러스터', clusterArray);

  const initialImageData = clusterArray.map((cluster, index) => {
    const imageUrl = cluster.thumbnailUrl || placeholderImage;  //thumbnailUrl 없으면 placeholderImage 사용
    return transform(cluster, index, imageUrl, minStrength, maxStrength);
  });

  const containerWidth = 1000;
  const containerHeight = 680;
  const topMargin = 100;

  const newPositions = arrangeImagesInCenter(initialImageData, containerWidth, containerHeight, topMargin);

  const finalImageData = initialImageData.map(image => {
    const position = newPositions[image.id] || { x: 0, y: 0 };
    return {
      ...image,
      position,
      left: `${position.x}px`,
      top: `${position.y}px`,
    };
  });

  saveProfileImages(finalImageData);
  const clusterHistoryResult = saveClusterHistory(finalImageData);
  const sliderResult = saveSliderHistory();
  const watchHistoryResult = saveWatchHistory_array();   


  if (clusterHistoryResult.success && sliderResult.success && watchHistoryResult.success) {
    console.log('✨ 모든 히스토리 저장 성공!', { clusterHistoryResult, sliderResult, watchHistoryResult });
  }

  return finalImageData;
}

