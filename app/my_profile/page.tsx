"use client";
import OpenAI from "openai";
import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import {
  DndContext,
  useDraggable,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Edit2, Save, CheckCircle2, RefreshCw, Search, X } from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { useRouter } from 'next/navigation';
import { myProfileImages } from '../data/dummyProfiles';
import { ImageData } from '@/types/profile';
import { useToast } from "@/components/ui/use-toast";

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

type Position = {
  x: number;
  y: number;
};

type VideoData = {
  title: string;
  embedId: string;
};

interface ImportedImageData {
  id: string;
  src: string;
  main_keyword: string;
  width: number;
  height: number;
  rotate: number;
  left: string;
  top: string;
  keywords: string[];
  sizeWeight: number;
  relatedVideos: VideoData[];
  category: string;
  mood_keyword: string;
  sub_keyword: string;
  description: string;
  desired_self: boolean;
  desired_self_profile: string | null;
  color?: string;
}

type ImageData = Required<ImportedImageData>;

type HistoryData = {
  timestamp: number;
  positions: Record<string, Position>;
  frameStyles: Record<string, 'healing' | 'inspiration' | 'people' | 'interest' | 'star'>;
  images: ImageData[];
};

type UnsplashImage = {
  id: string;
  urls: {
    regular: string;
  };
  alt_description: string;
};

type DraggableImageProps = {
  image: ImageData;
  position?: Position;
  isEditing: boolean;
  positions: Record<string, Position>;
  frameStyle: 'healing' | 'inspiration' | 'people' | 'interest' | 'star';
  onFrameStyleChange: (id: string, style: 'healing' | 'inspiration' | 'people' | 'interest' | 'star') => void;
  onImageChange: (id: string, newSrc: string, newKeyword: string) => void;
  onImageSelect: (image: ImageData) => void;
  isSelected: boolean;
  isSearchMode: boolean;
  onImageDelete: (id: string) => void;
};

function DraggableImage({ 
  image, 
  position, 
  isEditing,
  positions,
  frameStyle,
  onFrameStyleChange,
  onImageChange,
  onImageSelect,
  isSelected,
  isSearchMode,
  onImageDelete,
}: DraggableImageProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: image.id,
    disabled: !isEditing,
  });

  const [watchedVideos, setWatchedVideos] = useState<string[]>([]);
  const [showImageModal, setShowImageModal] = useState(false);
  const [alternativeImages, setAlternativeImages] = useState<any[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [aiRecommendedVideos, setAiRecommendedVideos] = useState<VideoData[]>([]);
  const [isLoadingAiVideos, setIsLoadingAiVideos] = useState(false);
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [panelPosition, setPanelPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showThumbnailModal, setShowThumbnailModal] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('search');

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0) rotate(${image.rotate}deg)`,
    transition: isEditing ? 'none' : 'transform 0.1s ease-in-out'
  } : {
    transform: `translate3d(${position?.x || 0}px, ${position?.y || 0}px, 0) rotate(${image.rotate}deg)`,
    transition: isEditing ? 'none' : 'transform 0.8s ease-in-out'
  };

  useEffect(() => {
    const generateHaiku = async () => {
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {"role": "user", "content": "write a haiku about ai"},
          ],
        });
        console.log(completion.choices[0].message);
      } catch (error) {
        console.error('OpenAI API 호출 오류:', error);
      }
    };

    // generateHaiku(); // 필요할 때만 주석 해제
  }, []);

  const getClipPath = () => {
    if (image.desired_self) {
      return 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';
    }
    switch (frameStyle) {
      case 'inspiration':
        // 12개의 꼭지점을 가진 부드러운 별 모양 (꽃 모양)
        return 'polygon(50% 0%, 61% 20%, 75% 20%, 80% 35%, 95% 40%, 90% 55%, 100% 65%, 90% 75%, 85% 90%, 70% 85%, 50% 100%, 30% 85%, 15% 90%, 10% 75%, 0% 65%, 10% 55%, 5% 40%, 20% 35%, 25% 20%, 39% 20%)';
      case 'interest':
        return 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
      default:
        return '';
    }
  };

  const getFrameStyle = () => {
    if (image.desired_self) {
      return ''; // star 모양을 위해 빈 문자열 반환
    }
    switch (frameStyle) {
      case 'healing':
        return 'rounded-lg';
      case 'inspiration':
        return '';
      case 'people':
        return 'rounded-full';
      case 'interest':
        return '';
    }
  };

  useEffect(() => {
    // YouTube IFrame API 로드
    const loadYouTubeAPI = () => {
      if (!window.YT) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

        return new Promise<void>((resolve) => {
          window.onYouTubeIframeAPIReady = () => {
            resolve();
          };
        });
      }
      return Promise.resolve();
    };

    // 플레이어 초기화
    const initializePlayers = () => {
      // 안전하게 처리: relatedVideos가 존재하고 배열인지 확인
      if (image.relatedVideos && Array.isArray(image.relatedVideos)) {
        image.relatedVideos.forEach((video) => {
          if (!video.embedId) return; // embedId가 없으면 건너뛰기
          
          try {
            const player = new window.YT.Player(`player-${video.embedId}`, {
              events: {
                onStateChange: (event) => {
                  // 영상이 끝났을 때 (상태 코드 0)
                  if (event.data === 0) {
                    setWatchedVideos(prev => {
                      if (prev.includes(video.embedId)) return prev;
                      return [...prev, video.embedId];
                    });
                  }
                }
              }
            });
          } catch (error) {
            console.error('YouTube 플레이어 초기화 오류:', error);
          }
        });
      }
    };

    // API 로드 후 플레이어 초기화
    loadYouTubeAPI().then(() => {
      // window.YT가 로드되었는지 확인
      if (window.YT && window.YT.Player) {
        initializePlayers();
      } else {
        // YT API가 아직 완전히 로드되지 않은 경우 대기
        const checkYT = setInterval(() => {
          if (window.YT && window.YT.Player) {
            clearInterval(checkYT);
            initializePlayers();
          }
        }, 100);
        
        // 일정 시간 후 체크 중단 (5초)
        setTimeout(() => clearInterval(checkYT), 5000);
      }
    });

    // 컴포넌트 언마운트 시 정리
    return () => {
      // 필요한 정리 작업
    };
  }, []);

  const handleVideoClick = (video: VideoData) => {
    // 로컬 스토리지에서 현재 시청 기록 가져오기
    const currentHistory = localStorage.getItem('watchHistory');
    const history = currentHistory ? JSON.parse(currentHistory) : [];
    
    // 이미 있는 영상인지 확인
    const isExist = history.some((item: any) => item.embedId === video.embedId);
    
    if (!isExist) {
      // 새로운 시청 기록 추가
      const newHistory = [
        {
          title: video.title,
          embedId: video.embedId,
          timestamp: Date.now()
        },
        ...history
      ];
      
      // 로컬 스토리지에 저장
      localStorage.setItem('watchHistory', JSON.stringify(newHistory));
      
      // 시청한 영상 목록 업데이트
      setWatchedVideos(prev => [...prev, video.embedId]);
    }
  };

  const handleFrameStyleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFrameStyleChange(image.id, e.target.value as 'healing' | 'inspiration' | 'people' | 'interest' | 'star');
  };

  // 네이버 이미지 검색 함수
  const fetchAlternativeImages = async () => {
    setIsLoadingImages(true);
    try {
      // 검색 키워드 설정
      const searchKeywords = [image.main_keyword, ...image.keywords].slice(0, 2).join(' ');
      console.log('검색 키워드:', searchKeywords);
      
      // 네이버 이미지 검색 API 호출
      const response = await fetch('/api/search-image?' + new URLSearchParams({
        query: searchKeywords
      }));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('이미지 검색 API 에러:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`이미지 검색 실패 (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      console.log('검색 결과:', data);
      
      // 검색 결과가 있는 경우
      if (data.items && data.items.length > 0) {
        // 결과를 랜덤하게 섞어서 최대 4개만 선택
        const shuffledResults = data.items
          .sort(() => Math.random() - 0.5)
          .slice(0, 4)
          .map((item: any) => ({
            id: item.link,
            urls: {
              regular: item.link
            },
            alt_description: item.title.replace(/<\/?b>/g, '')
          }));
        
        setAlternativeImages(shuffledResults);
      } else {
        console.log('검색 결과 없음');
        setAlternativeImages([]);
      }
    } catch (error) {
      console.error('이미지 검색 실패:', error);
      setAlternativeImages([]);
      // 에러 메시지 표시
      toast({
        title: "이미지 검색 실패",
        description: error instanceof Error ? error.message : "이미지를 검색하는 중에 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingImages(false);
    }
  };

  // 이미지 모달이 열릴 때 이미지 검색
  useEffect(() => {
    if (showImageModal) {
      fetchAlternativeImages();
    }
  }, [showImageModal]);

  // 이미지 선택 핸들러
  const handleImageSelect = async (selectedImage: any) => {
    try {
      const newSrc = selectedImage.urls.regular;
      const newKeyword = selectedImage.alt_description || image.main_keyword;
      
      // 부모 컴포넌트의 이미지 변경 함수 호출
      onImageChange(image.id, newSrc, newKeyword);
      
      setShowImageModal(false);
    } catch (error) {
      console.error('이미지 업데이트 실패:', error);
    }
  };

  // 이미지 클릭 핸들러 추가
  const handleImageClick = () => {
    if (!isEditing) {
      onImageSelect(image); // 부모 컴포넌트에 선택된 이미지 전달
    }
  };

  // YouTube API로 AI 추천 비디오 가져오기
  const fetchAiRecommendedVideos = useCallback(async () => {
    if (!image.main_keyword) return;
    
    setIsLoadingAiVideos(true);
    try {
      const API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
      
      if (!API_KEY) {
        console.error('YouTube API 키가 설정되지 않았습니다.');
        throw new Error('API 키가 없습니다.');
      }

      // 주요 키워드와 랜덤 키워드 조합으로 검색
      const randomKeyword = image.keywords[Math.floor(Math.random() * image.keywords.length)];
      const searchQuery = `${image.main_keyword} ${randomKeyword}`;
      
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchQuery)}&type=video&maxResults=4&regionCode=KR&key=${API_KEY}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('YouTube API 오류:', errorData);
        throw new Error(`YouTube API 오류: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.items) {
        const videoList = data.items.map((item: any) => ({
          title: item.snippet.title,
          embedId: item.id.videoId
        }));
        setAiRecommendedVideos(videoList);
      }
    } catch (error) {
      console.error('AI 추천 비디오 가져오기 오류:', error);
      setAiRecommendedVideos([]);
      
      // 에러 발생 시 대체 콘텐츠 표시
      const fallbackVideos = [
        {
          title: '추천 영상을 불러올 수 없습니다.',
          embedId: ''
        }
      ];
      setAiRecommendedVideos(fallbackVideos);
    } finally {
      setIsLoadingAiVideos(false);
    }
  }, [image.main_keyword, image.keywords]);

  // 이미지가 선택되었을 때 AI 추천 비디오 가져오기
  useEffect(() => {
    if (!isEditing) {
      fetchAiRecommendedVideos();
    }
  }, [fetchAiRecommendedVideos, isEditing]);

  // 프로필 방문 핸들러 추가
  const handleVisitProfile = () => {
    if (image.desired_self_profile) {
      router.push(`/others_profile/${image.desired_self_profile}`);
    }
  };

  // 썸네일 URL 생성 함수
  const getYouTubeThumbnail = (videoId: string) => {
    return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  };

  return (
    <>
      <Sheet>
        <div
          ref={setNodeRef}
          style={{
            ...style,
            position: 'absolute',
            width: image.width * (image.desired_self ? image.sizeWeight * 2 : image.sizeWeight * 4),
            height: (image.height + 80) * (image.desired_self ? image.sizeWeight * 2 : image.sizeWeight * 4),
            left: image.left,
            top: image.top,
            transform: transform ? 
              `translate3d(${transform.x + (positions[image.id]?.x || 0)}px, ${transform.y + (positions[image.id]?.y || 0)}px, 0) rotate(${image.rotate}deg)` :
              `translate3d(${positions[image.id]?.x || 0}px, ${positions[image.id]?.y || 0}px, 0) rotate(${image.rotate}deg)`,
            transition: isEditing ? 'none' : 'transform 0.8s ease-in-out',
            touchAction: 'none',
            zIndex: isSelected ? 30 : 10,
          }}
          className={`${isEditing ? "cursor-move" : isSearchMode ? "cursor-pointer" : ""} ${
            isSelected ? "ring-4 ring-blue-500 ring-opacity-70 shadow-xl scale-105" : ""
          }`}
        >
          {/* 메인 키워드 - 편집 모드와 일반 모드 모두에서 표시 */}
          <div className={`absolute inset-0 transform ${!isEditing && isSearchMode ? 'transition-all duration-300 group hover:scale-110 hover:z-30' : ''}`}
            onClick={() => !isEditing && isSearchMode && handleImageClick()}
          >
            {/* 키워드 */}
            <div 
              className="absolute -top-28 left-1/2 transform -translate-x-1/2 z-20 whitespace-nowrap 5"
              style={{
                fontSize: `${Math.max(80, 100 * image.sizeWeight)}px`,
              }}
            >
              <div 
                className="px-8 py-4 "
                style={{
                  transform: `scale(${image.sizeWeight})`,
                  transformOrigin: 'center',
                }}
              >
                <span className="font-bold text-gray-800">
                  #{image.main_keyword}
                </span>
              </div>
            </div>

            {/* 이미지 */}
            <SheetTrigger asChild>
              <div 
                className={`relative w-full h-[calc(100%-40px)] ${frameStyle === 'people' ? 'rounded-full overflow-hidden' : ''} ${!isEditing && !isSearchMode ? 'cursor-pointer' : ''}`}
                onClick={(e) => {
                  if (isEditing || isSearchMode) {
                    e.preventDefault();
                  } else {
                    setShowDetails(true);
                  }
                }}
              >
                <div
                  style={{
                    clipPath: getClipPath(),
                  }}
                  className={`relative w-full h-full ${getFrameStyle()} overflow-hidden`}
                >
                  <img
                    src={image.src || '/images/placeholder.jpg'}
                    alt={image.main_keyword}
                    className={`w-full h-full object-cover shadow-lg transition-transform duration-300 ${!isEditing && isSearchMode ? 'group-hover:scale-105' : ''}`}
                    onClick={(e) => {
                      console.log('이미지 정보:', image);
                      e.stopPropagation();
                      if (!isEditing && isSearchMode) {
                        handleImageClick();
                      }
                    }}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      console.error('이미지 로드 실패:', target.src);
                      target.src = '/images/placeholder.jpg';
                    }}
                  />
                </div>
                
                {/* 키워드를 이미지 하단에 배치 */}
                <div className="absolute bottom-0.5 left-0 right-0 flex flex-wrap gap-1 justify-center items-center p-1">
                  {image.keywords.map((keyword, idx) => (
                    <span
                      key={idx}
                      className="inline-block px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm rounded-full shadow-sm transition-colors"
                    >
                      #{keyword}
                    </span>
                  ))}
                </div>
              </div>
            </SheetTrigger>
          </div>

          {isEditing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {image.desired_self ? (
                <button 
                  className="flex items-center justify-center gap-1.5 py-2 px-4 min-w-[100px] bg-red-500/90 text-white backdrop-blur-sm rounded-full hover:bg-red-600 shadow-sm transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowDeleteDialog(true);
                  }}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <span className="text-sm font-medium">관심사 삭제하기</span>
                </button>
              ) : (
                <button 
                  className="flex items-center justify-center gap-1.5 py-2 px-4 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white shadow-lg transition-all hover:scale-105 z-20"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowImageModal(true);
                  }}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                  <span className="text-sm font-medium">이미지 변경</span>
                </button>
              )}
            </div>
          )}
          {isEditing && (
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-white rounded-full shadow-lg px-3 py-1 z-40">
              <select 
                className="text-sm border-none bg-transparent outline-none cursor-pointer"
                value={frameStyle}
                onChange={handleFrameStyleChange}
                onClick={(e) => e.stopPropagation()}
              >
                {image.desired_self ? (
                  <option value="star">⭐️ Desired_self</option>
                ) : (
                  <>
                    <option value="healing">⬛️ 나에게 힐링이 되는 영상</option>
                    <option value="inspiration">⬡ 영감을 주는 영상</option>
                    <option value="people">⚪️ 내가 좋아하는 사람</option>
                    <option value="interest">🔶 나만의 관심사</option>
                  </>
                )}
              </select>
            </div>
          )}
          {isEditing && (
            <div
              className="absolute inset-0 z-10"
              {...listeners}
              {...attributes}
            />
          )}
        </div>
      </Sheet>

      <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
        <DialogContent className="max-w-[80vw] w-[80vw] min-w-[80vw] max-h-[80vh] h-[80vh] min-h-[80vh]">
          <DialogHeader>
            <DialogTitle>이미지 변경</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-12 gap-6 h-[calc(100%-60px)]">
            {/* 기존 이미지 (좌측) */}
            <div className="col-span-6 flex items-center justify-center">
              <div className="w-[80%] aspect-square relative rounded-lg overflow-hidden border-2 border-blue-500 shadow-lg">
                <img
                  src={image.src}
                  alt={image.main_keyword}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* 새 이미지 선택 옵션 (우측) */}
            <div className="col-span-6 space-y-4">
              <Tabs defaultValue="search" className="w-full" value={activeTab} onValueChange={setActiveTab}>
                <div className="flex items-center justify-between mb-3">
                  <TabsList>
                    <TabsTrigger value="search" className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" />
                      이미지 검색
                    </TabsTrigger>
                    <TabsTrigger value="thumbnails" className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M16 8h.01"/>
                      </svg>
                      관련 영상 썸네일
                    </TabsTrigger>
                  </TabsList>
                  {activeTab === 'search' && (
                    <button
                      onClick={() => fetchAlternativeImages()}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                    >
                      <RefreshCw className="h-4 w-4" />
                      새로 검색
                    </button>
                  )}
                </div>

                <TabsContent value="search" className="mt-0">
                  {isLoadingImages ? (
                    <div className="grid grid-cols-2 gap-4 p-4">
                      {[1, 2, 3, 4].map((_, index) => (
                        <div key={index} className="aspect-square bg-gray-100 animate-pulse rounded-lg" />
                      ))}
                    </div>
                  ) : alternativeImages.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4 p-4">
                      {alternativeImages.map((altImage) => (
                        <div 
                          key={altImage.id}
                          className="relative aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-blue-500 transition-colors cursor-pointer group shadow-md"
                          onClick={() => handleImageSelect(altImage)}
                        >
                          <img
                            src={altImage.urls.regular}
                            alt={altImage.alt_description || '대체 이미지'}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = '/images/placeholder.jpg';
                            }}
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button className="bg-white/90 backdrop-blur-sm text-gray-800 px-4 py-2 rounded-full font-medium hover:bg-white transition-colors">
                              선택하기
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-gray-500">검색된 이미지가 없습니다.</div>
                    </div>
                  )}
                  <div className="bg-blue-50 rounded-lg p-4 mt-4">
                    <div className="text-sm text-blue-600">
                      * 현재 키워드 ({image.keywords.join(', ')})에 맞는 이미지를 보여드립니다.
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="thumbnails" className="mt-0">
                  <div className="grid grid-cols-2 gap-4 p-4">
                    {image.relatedVideos.map((video, index) => (
                      <div key={index} className="relative group">
                        <div 
                          className="aspect-video rounded-lg overflow-hidden shadow-lg cursor-pointer"
                          onClick={() => {
                            const thumbnailUrl = getYouTubeThumbnail(video.embedId);
                            handleImageChange(image.id, thumbnailUrl, image.main_keyword);
                            setShowThumbnailModal(false);
                          }}
                        >
                          <img
                            src={getYouTubeThumbnail(video.embedId)}
                            alt={video.title}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = '/images/placeholder.jpg';
                            }}
                          />
                        </div>
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                          <button
                            className="bg-white text-gray-800 px-4 py-2 rounded-full text-sm font-medium hover:bg-gray-100 transition-colors"
                          >
                            이미지로 변경하기
                          </button>
                        </div>
                        <div className="mt-2 text-sm font-medium line-clamp-2">
                          {video.title}
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 드래그 가능한 상세 정보 창 */}
      {showDetails && (
        <div 
          className="fixed top-0 right-0 w-[400px] h-[calc(100vh-150px)] bg-white shadow-xl overflow-hidden transition-all duration-300"
          style={{
            zIndex: 99999,
            transform: 'translateX(0)',
            transition: 'all 0.3s ease-in-out',
            top: '0px',
            right: '-80px'
            
          }}
        >
          <div className="flex items-center justify-between p-4 border-b bg-white">
            <h2 className="text-base sm:text-lg font-semibold">{image.main_keyword}</h2>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setShowDetails(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="h-[calc(100%-60px)] overflow-y-auto px-2 sm:px-4">
            <div className="flex flex-col w-full mx-auto pb-8">
              <div className="relative w-full h-[150px] sm:h-[300px] flex-shrink-0">
                <img
                  src={image.src}
                  alt={image.main_keyword}
                  className="w-full h-full object-cover rounded-lg"
                />
                
                <div className="absolute top-4 right-4">
                  <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-black/50 backdrop-blur-md rounded-full text-white text-xs sm:text-sm font-medium">
                    {image.category}
                  </span>
                </div>
              </div>
              <div className="mt-3 sm:mt-4 space-y-3 sm:space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                  <div className="bg-emerald-50 rounded-xl p-2 sm:p-3 text-center">
                    <h4 className="text-xs font-medium text-emerald-600 mb-0.5 sm:mb-1">메인 키워드</h4>
                    <p className="text-xs sm:text-sm font-bold text-emerald-900">#{image.main_keyword}</p>
                  </div>
                  
                  <div className="bg-purple-50 rounded-xl p-2 sm:p-3 text-center">
                    <h4 className="text-xs font-medium text-purple-600 mb-0.5 sm:mb-1">감성/분위기</h4>
                    <p className="text-xs sm:text-sm font-bold text-purple-900">#{image.mood_keyword}</p>
                  </div>
                  
                  <div className="bg-blue-50 rounded-xl p-2 sm:p-3 text-center">
                    <h4 className="text-xs font-medium text-blue-600 mb-0.5 sm:mb-1">서브 키워드</h4>
                    <p className="text-xs sm:text-sm font-bold text-blue-900">#{image.sub_keyword}</p>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-800">관심도</h4>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      image.sizeWeight >= 1.2 ? "bg-red-100 text-red-700" :
                      image.sizeWeight >= 0.8 ? "bg-yellow-100 text-yellow-700" :
                      "bg-blue-100 text-blue-700"
                    }`}>
                      {image.sizeWeight >= 1.2 ? "강" :
                      image.sizeWeight >= 0.8 ? "중" : "약"}
                    </span>
                  </div>
                  
                  <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className={`absolute top-0 left-0 h-full rounded-full transition-all duration-500 ${
                        image.sizeWeight >= 1.2 ? "bg-gradient-to-r from-red-400 to-red-500" :
                        image.sizeWeight >= 0.8 ? "bg-gradient-to-r from-yellow-400 to-yellow-500" :
                        "bg-gradient-to-r from-blue-400 to-blue-500"
                      }`}
                      style={{ width: `${Math.min(image.sizeWeight * 50, 100)}%` }}
                    />
                  </div>

                  <p className="mt-2 text-xs text-gray-600">
                    {image.sizeWeight >= 1.2 ? "이 주제에 대한 높은 관심도를 보입니다" :
                    image.sizeWeight >= 0.8 ? "이 주제에 대해 보통 수준의 관심을 가지고 있습니다" :
                    "이 주제에 대해 가볍게 관심을 두고 있습니다"}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="text-sm font-semibold mb-2">이미지 설명</h4>
                  <p className="text-sm text-gray-700">{image.description}</p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">관련 키워드</h4>
                  <div className="flex flex-wrap gap-2">
                    {image.keywords.map((keyword, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-xs font-medium hover:bg-gray-200 transition-colors"
                      >
                        #{keyword}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  {!image.desired_self ? (
                    <Tabs defaultValue="history" className="w-full">
                      <div className="bg-gray-70/70 rounded-lg">
                        <TabsList className="w-full grid grid-cols-2 py-0">
                          <TabsTrigger value="history" className="text-base py-1">Where this image from</TabsTrigger>
                          <TabsTrigger value="AI" className="text-base py-1">The way Algorithm see you</TabsTrigger>
                        </TabsList>
                        <br/> <br/>
                        
                        <TabsContent value="history" className="px-4 pb-4">
                          <div className="grid gap-6">
                            {image.relatedVideos.map((video, idx) => (
                              <div key={idx} className="space-y-2">
                                <h5 className="text-sm font-medium text-gray-800 mb-1">{video.title}</h5>
                                <div 
                                  className="relative w-full pt-[56.25%] bg-gray-100 rounded-lg overflow-hidden cursor-pointer"
                                  onClick={() => handleVideoClick(video)}
                                >
                                  <iframe
                                    id={`player-${video.embedId}`}
                                    className="absolute inset-0 w-full h-full"
                                    src={`https://www.youtube.com/embed/${video.embedId}?enablejsapi=1`}
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                  />
                                  <div className={`absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full backdrop-blur-sm transition-all duration-300 ${
                                    watchedVideos.includes(video.embedId) 
                                      ? "bg-green-500/80 text-white" 
                                      : "bg-gray-900/80 text-gray-200"
                                  }`}>
                                    <CheckCircle2 className={`h-3 w-3 ${
                                      watchedVideos.includes(video.embedId)
                                        ? "text-white"
                                        : "text-gray-400"
                                    }`} />
                                    <span className="text-xs font-medium">
                                      {watchedVideos.includes(video.embedId) ? "시청함" : "시청안함"}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </TabsContent>
                        
                        <TabsContent value="AI" className="px-4 pb-4">
                          <div className="grid gap-6">
                            {isLoadingAiVideos ? (
                              <div className="flex justify-center items-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                              </div>
                            ) : aiRecommendedVideos.length > 0 ? (
                              aiRecommendedVideos.map((video, idx) => (
                                <div key={idx} className="space-y-2">
                                  <h5 className="text-sm font-medium text-gray-800 mb-1">
                                    <span className="text-blue-500 font-semibold">AI 추천:</span> {video.title}
                                  </h5>
                                  <div 
                                    className="relative w-full pt-[56.25%] bg-gray-100 rounded-lg overflow-hidden cursor-pointer"
                                    onClick={() => handleVideoClick(video)}
                                  >
                                    <iframe
                                      id={`player-ai-${video.embedId}`}
                                      className="absolute inset-0 w-full h-full"
                                      src={`https://www.youtube.com/embed/${video.embedId}?enablejsapi=1`}
                                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                      allowFullScreen
                                    />
                                    <div className={`absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full backdrop-blur-sm transition-all duration-300 ${
                                      watchedVideos.includes(video.embedId) 
                                        ? "bg-green-500/80 text-white" 
                                        : "bg-gray-900/80 text-gray-200"
                                    }`}>
                                      <CheckCircle2 className={`h-3 w-3 ${
                                        watchedVideos.includes(video.embedId)
                                          ? "text-white"
                                          : "text-gray-400"
                                      }`} />
                                      <span className="text-xs font-medium">
                                        {watchedVideos.includes(video.embedId) ? "시청함" : "시청안함"}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-center py-8">
                                <p className="text-sm text-gray-500">
                                  '{image.main_keyword}' 키워드에 대한 AI 추천 영상을 가져올 수 없습니다.
                                </p>
                                <button
                                  onClick={fetchAiRecommendedVideos}
                                  className="mt-3 px-3 py-1.5 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors"
                                >
                                  다시 시도
                                </button>
                              </div>
                            )}
                          </div>
                        </TabsContent>
                      </div>
                    </Tabs>
                  ) : (
                    <div className="space-y-6">
                      {/* 프로필 보기 버튼 */}
                      <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl p-6">
                        <div className="text-center space-y-3">
                          <h3 className="text-base font-semibold text-gray-800">
                            이 이미지의 원본 프로필
                          </h3>
                          <p className="text-sm text-gray-600">
                            이 이미지를 가져온 프로필을 방문하여 더 많은 관심사를 발견해보세요
                          </p>
                          <Button
                            onClick={handleVisitProfile}
                            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-6 py-2 rounded-full text-sm font-semibold shadow-lg transform transition-all duration-300 hover:scale-105"
                          >
                            프로필 방문하기
                          </Button>
                        </div>
                      </div>

                      {/* 추천 영상 섹션 */}
                      <div className="bg-gray-50 rounded-xl p-4">
                        <h3 className="text-sm font-semibold mb-4 text-gray-800">관련된 추천 영상</h3>
                        <div className="grid gap-4">
                          {image.relatedVideos.map((video, idx) => (
                            <div key={idx} className="bg-white rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow">
                              <div className="relative pt-[56.25%]">
                                <iframe
                                  className="absolute inset-0 w-full h-full"
                                  src={`https://www.youtube.com/embed/${video.embedId}`}
                                  title={video.title}
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                />
                              </div>
                              <div className="p-3">
                                <h4 className="text-sm font-medium text-gray-900 line-clamp-2">{video.title}</h4>
                                <div className="mt-1 flex items-center gap-2">
                                  {watchedVideos.includes(video.embedId) ? (
                                    <span className="inline-flex items-center text-green-600 text-xs">
                                      <CheckCircle2 className="w-3 h-3 mr-1" />
                                      시청 완료
                                    </span>
                                  ) : (
                                    <span className="text-gray-500 text-xs">아직 시청하지 않음</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 썸네일 모달 */}
      <Dialog open={showThumbnailModal} onOpenChange={setShowThumbnailModal}>
        <DialogContent className="max-w-[90vw] w-[90vw] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {image.main_keyword}의 관련 영상 썸네일
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4">
            {image.relatedVideos.map((video, index) => (
              <div key={index} className="relative group">
                <div 
                  className="aspect-video rounded-lg overflow-hidden shadow-lg cursor-pointer"
                  onClick={() => {
                    const thumbnailUrl = getYouTubeThumbnail(video.embedId);
                    handleImageChange(image.id, thumbnailUrl, image.main_keyword);
                    setShowThumbnailModal(false);
                  }}
                >
                  <img
                    src={getYouTubeThumbnail(video.embedId)}
                    alt={video.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/images/placeholder.jpg';
                    }}
                  />
                </div>
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                  <button
                    className="bg-white text-gray-800 px-4 py-2 rounded-full text-sm font-medium hover:bg-gray-100 transition-colors"
                  >
                    이미지로 변경하기
                  </button>
                </div>
                <div className="mt-2 text-sm font-medium line-clamp-2">
                  {video.title}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// YouTube IFrame API 타입 선언
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export default function MyProfilePage() {
  const [positions, setPositions] = useState<Record<string, Position>>({});
  const [frameStyles, setFrameStyles] = useState<Record<string, 'healing' | 'inspiration' | 'people' | 'interest' | 'star'>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [histories, setHistories] = useState<HistoryData[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const placeholderImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='200' viewBox='0 0 300 200'%3E%3Crect width='300' height='200' fill='%23cccccc'/%3E%3Ctext x='50%25' y='50%25' font-size='18' text-anchor='middle' alignment-baseline='middle' font-family='Arial, sans-serif' fill='%23666666'%3E이미지를 찾을 수 없습니다%3C/text%3E%3C/svg%3E";

  const [images, setImages] = useState<ImageData[]>(() => {
    // localStorage에서 profileImages 불러오기
    if (typeof window !== 'undefined') {
      const savedProfileImages = localStorage.getItem('profileImages');
      if (savedProfileImages) {
        console.log('로드된 프로필 이미지:', savedProfileImages); // 디버깅용 로그
        const parsedImages = JSON.parse(savedProfileImages) as ImportedImageData[];
        return parsedImages.map(img => ({
          ...img,
          src: img.src || placeholderImage,
          color: img.color || 'gray',
          desired_self_profile: img.desired_self_profile || null
        }));
      }
    }
    // 저장된 데이터가 없을 경우 빈 배열 반환
    console.log('프로필 이미지를 찾을 수 없습니다.'); // 디버깅용 로그
    return [];
  });
  const [visibleImageIds, setVisibleImageIds] = useState<Set<string>>(new Set());

  const [profile, setProfile] = useState({
    nickname: '',
    description: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingProfile, setIsGeneratingProfile] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [selectedImages, setSelectedImages] = useState<ImageData[]>([]);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const router = useRouter();
  const [showGeneratingDialog, setShowGeneratingDialog] = useState(false);
  const [generatingStep, setGeneratingStep] = useState(0);
  const generatingSteps = [
    "당신의 시청 기록을 분석하고 있습니다...",
    "알고리즘이 당신의 취향을 이해하고 있습니다...",
    "흥미로운 패턴을 발견했습니다!",
    "당신만의 특별한 별명을 생성중입니다..."
  ];

  const [bgColor, setBgColor] = useState('bg-white');

  const colorOptions = [
    { name: '화이트', class: 'bg-white' },
    { name: '크림', class: 'bg-amber-50' },
    { name: '라벤더', class: 'bg-purple-50' },
    { name: '민트', class: 'bg-emerald-50' },
    { name: '피치', class: 'bg-rose-50' },
    { name: '스카이', class: 'bg-sky-50' },
  ];

  // 배경색 저장 및 불러오기
  useEffect(() => {
    // 저장된 배경색 불러오기
    const savedBgColor = localStorage.getItem('moodboard-bg-color');
    if (savedBgColor) {
      setBgColor(savedBgColor);
    }
  }, []);

  // 배경색 변경 핸들러
  const handleBgColorChange = (colorClass: string) => {
    setBgColor(colorClass);
    localStorage.setItem('moodboard-bg-color', colorClass);
  };

  // 데이터 마이그레이션을 위한 useEffect 추가
  useEffect(() => {
    // 로컬 스토리지에서 기존 데이터 마이그레이션
    const migrateLocalStorageData = () => {
      try {
        // 무드보드 히스토리 마이그레이션
        const storedHistories = localStorage.getItem('moodboardHistories');
        if (storedHistories) {
          const parsedHistories = JSON.parse(storedHistories);
          
          // 각 히스토리의 이미지 데이터 마이그레이션
          const migratedHistories = parsedHistories.map((history: any) => {
            // 이미지 배열 마이그레이션
            const migratedImages = history.images?.map((img: any) => {
              // alt 필드가 있고 main_keyword 필드가 없는 경우에만 마이그레이션
              if (img.alt && !img.main_keyword) {
                return {
                  ...img,
                  main_keyword: img.alt, // alt 값을 main_keyword로 복사
                };
              }
              return img;
            });
            
            return {
              ...history,
              images: migratedImages || history.images,
            };
          });
          
          // 마이그레이션된 데이터 저장
          localStorage.setItem('moodboardHistories', JSON.stringify(migratedHistories));
          console.log('무드보드 히스토리 데이터 마이그레이션 완료');
        }
        
        // 클러스터 이미지 마이그레이션
        const storedClusterImages = localStorage.getItem('clusterImages');
        if (storedClusterImages) {
          const parsedClusterImages = JSON.parse(storedClusterImages);
          
          // 각 클러스터 이미지 마이그레이션
          const migratedClusterImages: Record<string, any> = {};
          
          Object.entries(parsedClusterImages).forEach(([key, value]: [string, any]) => {
            migratedClusterImages[key] = {
              ...value,
              main_keyword: key, // 키를 main_keyword로 사용
            };
          });
          
          // 마이그레이션된 데이터 저장
          localStorage.setItem('clusterImages', JSON.stringify(migratedClusterImages));
          console.log('클러스터 이미지 데이터 마이그레이션 완료');
        }
        
        // 마이그레이션 완료 표시
        localStorage.setItem('dataMigrationCompleted', 'true');
      } catch (error) {
        console.error('데이터 마이그레이션 중 오류 발생:', error);
      }
    };
    
    // 마이그레이션이 이미 완료되었는지 확인
    const migrationCompleted = localStorage.getItem('dataMigrationCompleted');
    if (migrationCompleted !== 'true') {
      migrateLocalStorageData();
    }
  }, []);

  // 컴포넌트 마운트 시 저장된 히스토리 불러오기 및 최근 위치 설정
  useEffect(() => {
    const savedHistories = localStorage.getItem('moodboardHistories');
    if (savedHistories) {
      const parsedHistories = JSON.parse(savedHistories);
      // 기존 히스토리 데이터 마이그레이션
      const migratedHistories = parsedHistories.map((history: any) => ({
        ...history,
        images: history.images || images // 이미지 배열이 없으면 현재 이미지 사용
      }));
      
      setHistories(migratedHistories);
      
      if (migratedHistories.length > 0) {
        const latestHistory = migratedHistories[migratedHistories.length - 1];
        setPositions(latestHistory.positions);
        setCurrentHistoryIndex(migratedHistories.length - 1);
        setFrameStyles(latestHistory.frameStyles || {});
        if (latestHistory.images && latestHistory.images.length > 0) {
          setImages(latestHistory.images);
          // 최신 히스토리의 모든 이미지 ID를 visibleImageIds에 추가
          setVisibleImageIds(new Set(latestHistory.images.map((img: ImageData) => img.id)));
        }
      }
      // 마이그레이션된 데이터 저장
      localStorage.setItem('moodboardHistories', JSON.stringify(migratedHistories));
    } else {
      // 초기 히스토리 생성
      const initialHistory: HistoryData = {
        timestamp: Date.now(),
        positions: positions,
        frameStyles: frameStyles,
        images: images
      };
      setHistories([initialHistory]);
      localStorage.setItem('moodboardHistories', JSON.stringify([initialHistory]));
      setCurrentHistoryIndex(0);
      // 초기 히스토리의 모든 이미지 ID를 visibleImageIds에 추가
      setVisibleImageIds(new Set(images.map(img => img.id)));
    }
  }, []);

  // 히스토리 재생 효과 수정
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (isPlaying && histories.length > 0) {
      intervalId = setInterval(() => {
        setCurrentHistoryIndex(prev => {
          const nextIndex = prev + 1;
          if (nextIndex >= histories.length) {
            setIsPlaying(false);
            return prev;
          }
          
          // 다음 히스토리의 이미지 ID 목록 가져오기
          const nextHistoryImageIds = new Set(histories[nextIndex].images.map(img => img.id));
          setVisibleImageIds(nextHistoryImageIds);
          
          setPositions(histories[nextIndex].positions);
          setFrameStyles(histories[nextIndex].frameStyles || {});
          return nextIndex;
        });
      }, 2000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isPlaying, histories]);

  // 히스토리 클릭 핸들러 수정
  const handleHistoryClick = (index: number) => {
    if (currentHistoryIndex === index) return;
    
    // 선택한 히스토리의 이미지 ID 목록 가져오기
    const selectedHistoryImageIds = new Set(histories[index].images.map(img => img.id));
    setVisibleImageIds(selectedHistoryImageIds);
    
    setCurrentHistoryIndex(index);
    setPositions(histories[index].positions);
    setFrameStyles(histories[index].frameStyles || {});
  };

  // 히스토리 재생 시작 핸들러 수정
  const handlePlayHistory = () => {
    if (histories.length > 0) {
      // 첫 번째 히스토리의 이미지 ID 목록 가져오기
      const firstHistoryImageIds = new Set(histories[0].images.map(img => img.id));
      setVisibleImageIds(firstHistoryImageIds);
      
      setCurrentHistoryIndex(0);
      setPositions(histories[0].positions);
      setFrameStyles(histories[0].frameStyles || {});
      setIsPlaying(true);
    }
  };

  const handleFrameStyleChange = (id: string, style: 'healing' | 'inspiration' | 'people' | 'interest' | 'star') => {
    setFrameStyles(prev => ({
      ...prev,
      [id]: style
    }));
  };

  const handleSave = () => {
    const newHistory: HistoryData = {
      timestamp: Date.now(),
      positions: positions,
      frameStyles: frameStyles,
      images: images  // 현재 이미지 배열 추가
    };

    const updatedHistories = [...histories, newHistory];
    setHistories(updatedHistories);
    localStorage.setItem('moodboardHistories', JSON.stringify(updatedHistories));
    setCurrentHistoryIndex(updatedHistories.length - 1);
    setIsEditing(false);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (!isEditing) return;
    
    const { active, delta } = event;
    setPositions(prev => {
      const oldPosition = prev[active.id] || { x: 0, y: 0 };
      return {
        ...prev,
        [active.id]: {
          x: oldPosition.x + delta.x,
          y: oldPosition.y + delta.y,
        },
      };
    });
  };

  const handleImageChange = (id: string, newSrc: string, newKeyword: string) => {
    // 이미지 배열 업데이트
    const updatedImages = images.map(img => 
      img.id === id ? { ...img, src: newSrc } : img
    );
    
    // 이미지 상태 업데이트
    setImages(updatedImages);
    
    // localStorage의 profileImages도 업데이트
    const profileImagesData = localStorage.getItem('profileImages');
    if (profileImagesData) {
      const profileImages = JSON.parse(profileImagesData);
      const updatedProfileImages = {
        ...profileImages,
        [id]: {
          ...profileImages[id],
          src: newSrc
        }
      };
      localStorage.setItem('profileImages', JSON.stringify(updatedProfileImages));
    }
    
    // 새로운 히스토리 생성 및 저장
    const newHistory: HistoryData = {
      timestamp: Date.now(),
      positions: positions,
      frameStyles: frameStyles,
      images: updatedImages
    };

    const updatedHistories = [...histories, newHistory];
    setHistories(updatedHistories);
    localStorage.setItem('moodboardHistories', JSON.stringify(updatedHistories));
    setCurrentHistoryIndex(updatedHistories.length - 1);
  };

  // 프로필 생성 함수를 별도로 분리
  const generateUserProfile = useCallback(async () => {
    try {
      setIsGeneratingProfile(true);
      setShowGeneratingDialog(true);
      
      // 각 단계별로 딜레이를 주며 진행
      for (let i = 0; i < generatingSteps.length; i++) {
        setGeneratingStep(i);
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      // localStorage에서 profileImages 데이터 가져오기
      const profileImagesData = localStorage.getItem('profileImages');
      console.log('프로필 이미지 데이터:', profileImagesData);

      if (!profileImagesData) {
        const defaultProfile = {
          nickname: '알고리즘 탐험가',
          description: '아직 프로필 이미지가 없습니다. 메인 페이지에서 "Tell me who I am"을 클릭하여 프로필을 생성해보세요!'
        };
        setProfile(defaultProfile);
        return;
      }

      const profileImages = JSON.parse(profileImagesData);
      
      // 프롬프트 생성을 위한 데이터 가공
      const imageData = Object.values(profileImages).map((image: any) => ({
        main_keyword: image.main_keyword,
        category: image.category,
        description: image.description,
        mood_keyword: image.mood_keyword,
        keywords: image.keywords
      }));

      const prompt = `
당신은 사용자의 관심사와 성향을 분석하여 그들의 성격과 취향을 파악하는 전문가입니다.
다음은 사용자의 관심사와 성향을 분석한 정보입니다:

${imageData.map((image: any, index: number) => `
이미지 ${index + 1}:
- 주요 키워드: ${image.main_keyword || '정보 없음'}
- 카테고리: ${image.category || '미분류'}
- 설명: ${image.description || '정보 없음'}
- 감성 키워드: ${image.mood_keyword || '정보 없음'}
- 관련 키워드: ${image.keywords?.join(', ') || '정보 없음'}
`).join('\n')}

위 정보를 바탕으로 다음 두 가지를 한국어로 생성해주세요:

1. 사용자의 대표 관심사를 종합하여 봤을때, 여러가지를 혼합하여 새로운 키워드로 취향과 성격을 반영한 독특하고 창의적인 짧은 명사 별명 (예: "감성적인 여행자", "호기심 많은 지식탐험가" 등)
2. 중요!!: 별명 생성시 재밌는 동물, 물건, 이름등으로 은유법이나 비유 명사를 무조건 활용해야함 ("예: 현아를 좋아하는 사과, 토끼)
3. 사용자의 콘텐츠 소비 패턴, 취향, 관심사를 2-3문장으로 짧게 재밌게 흥미롭게 요약한 설명, 사용자를 예측해도 됨
4. [생성된 설명]을 생성하고 난 다음 { } 안에 어떤 기준으로 이러한 별명과 설명이 생성되었는지 5문장으로 설명해주세요.

응답 형식:
별명: [생성된 별명]
설명: [생성된 설명]
`;

      console.log('OpenAI 요청 시작');
      const completion = await openai.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "gpt-4o-mini",
        temperature: 0.9,
      });

      const response = completion.choices[0].message.content || '';
      console.log('OpenAI 응답:', response);
      
      // 응답 파싱 개선
      const nicknameMatch = response.match(/별명:\s*(.*?)(?=\n|$)/);
      const descriptionMatch = response.match(/설명:\s*([\s\S]*?)(?=\n\n|$)/);
      
      const newProfile = {
        nickname: nicknameMatch ? nicknameMatch[1].trim() : '알고리즘 탐험가',
        description: descriptionMatch 
          ? descriptionMatch[1].trim() 
          : '당신만의 독특한 콘텐츠 취향을 가지고 있습니다. 메인 페이지에서 더 많은 관심사를 추가해보세요!'
      };

      console.log('새로운 프로필:', newProfile);
      setProfile(newProfile);
      
    } catch (error) {
      console.error('프로필 생성 오류:', error);
      setProfile({
        nickname: '알고리즘 탐험가',
        description: '프로필 생성 중 오류가 발생했습니다. 나중에 다시 시도해주세요.'
      });
    } finally {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setIsGeneratingProfile(false);
      setShowGeneratingDialog(false);
      setGeneratingStep(0);
    }
  }, []); // 의존성 배열 비움

  // 이미지 선택 핸들러
  const handleImageSelect = (image: ImageData) => {
    setSelectedImage(image);
    
    // 이미 선택된 이미지인지 확인
    const isAlreadySelected = selectedImages.some(img => img.id === image.id);
    
    if (isAlreadySelected) {
      // 이미 선택된 이미지라면 선택 해제
      setSelectedImages(prev => prev.filter(img => img.id !== image.id));
    } else {
      // 새로 선택된 이미지라면 배열에 추가
      setSelectedImages(prev => [...prev, image]);
    }
  };

  // 검색 모드 토글 함수
  const toggleSearchMode = () => {
    setIsSearchMode(!isSearchMode);
    if (isSearchMode) {
      // 검색 모드 종료 시 선택된 이미지들 초기화
      setSelectedImages([]);
      setSelectedImage(null);
    }
  };

  // 검색 버튼 클릭 핸들러
  const handleSearch = () => {
    if (selectedImages.length === 0) return;
    
    // 선택된 키워드들을 쿼리 파라미터로 변환
    const keywords = selectedImages.map(img => img.main_keyword).join(',');
    
    // search 페이지로 이동
    router.push(`/search?keywords=${encodeURIComponent(keywords)}`);
  };

  const handleImageDelete = (id: string) => {
    // 이미지 삭제
    const updatedImages = images.filter(img => img.id !== id);
    setImages(updatedImages);
    
    // 새로운 히스토리 생성 및 저장
    const newHistory: HistoryData = {
      timestamp: Date.now(),
      positions,
      frameStyles,
      images: updatedImages
    };
    
    const updatedHistories = [...histories, newHistory];
    setHistories(updatedHistories);
    localStorage.setItem('moodboardHistories', JSON.stringify(updatedHistories));
    setCurrentHistoryIndex(updatedHistories.length - 1);
    
    // visibleImageIds 업데이트
    setVisibleImageIds(new Set(updatedImages.map(img => img.id)));
  };

  // 컴포넌트 시작 부분에 useEffect 추가
  useEffect(() => {
    // 페이지 로드 시 자동으로 별명 생성
    generateUserProfile();
  }, []); // 빈 의존성 배열로 컴포넌트 마운트 시 한 번만 실행

  return (
    <main className={`fixed inset-0 overflow-y-auto transition-colors duration-500 ${bgColor}`}>
      {/* 생성 중 다이얼로그 */}
      <Dialog open={showGeneratingDialog} onOpenChange={setShowGeneratingDialog}>
        <DialogContent className="sm:max-w-[500px] bg-black/95 border-none text-white">
          <DialogHeader>
            <DialogTitle className="text-white text-center">알고리즘 프로필 생성</DialogTitle>
          </DialogHeader>
          <div className="py-10 px-4">
            <div className="flex flex-col items-center space-y-6">
              {/* 로딩 애니메이션 */}
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 rounded-full border-4 border-blue-500/30 animate-pulse"></div>
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 animate-spin"></div>
                <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-purple-500 animate-spin-slow"></div>
                <div className="absolute inset-4 rounded-full border-4 border-transparent border-t-pink-500 animate-spin-slower"></div>
              </div>
              
              {/* 현재 단계 메시지 */}
              <div className="text-center space-y-2">
                <p className="text-xl font-semibold animate-pulse">
                  {generatingSteps[generatingStep]}
                </p>
                <div className="flex justify-center gap-2 mt-4">
                  {generatingSteps.map((_, index) => (
                    <div
                      key={index}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        index === generatingStep ? 'bg-blue-500 scale-125' : 'bg-gray-600'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 검색 모드일 때 배경 그라데이션 추가 */}
      {isSearchMode && (
        <div className="fixed inset-0 z-10 bg-gradient-to-br from-emerald-900 via-black-900 to-white-800 animate-gradient-x">
          {/* 배경 패턴 효과 */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0 bg-[url('/images/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]"></div>
          </div>
        </div>
      )}
      
      {/* 선택된 이미지의 main_keyword 표시 (중앙) - 짧은 애니메이션 후 사라짐 */}
      {selectedImage && isSearchMode && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-20 pointer-events-none animate-fadeOutWithDelay"
          style={{animationDelay: '1.5s'}} // 1.5초 동안 표시된 후 사라짐
        >
          <div className="relative">
            <h1 className="text-[150px] font-bold text-white opacity-10 animate-scaleUp">
              {selectedImage.main_keyword.toUpperCase()}
            </h1>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-white/10 backdrop-blur-md px-8 py-4 rounded-full animate-pulseOnce">
                <span className="text-4xl font-bold text-white">
                  {selectedImage.main_keyword}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 검색 모드일 때 표시되는 제목 */}
      {isSearchMode && (
        <div className="absolute top-28 left-0 right-0 text-center z-40">
          <h1 className="text-4xl font-bold text-white drop-shadow-lg">
            Explore someone's interest based on your interest
          </h1>
          <div className="mt-4 text-white/80 text-lg max-w-2xl mx-auto">
            Discover profiles that match your unique algorithm preferences
          </div>
          
          {/* 선택된 이미지들의 키워드 컨테이너 - 항상 존재하지만 내용물이 변함 */}
          <div className="mt-16 flex flex-col items-center gap-6 min-h-[200px] transition-all duration-500">
            {/* 키워드 태그 - 선택된 이미지가 있을 때만 표시 */}
            <div 
              className={`flex flex-wrap gap-4 justify-center max-w-4xl mx-auto transition-all duration-500 ${
                selectedImages.length > 0 ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform -translate-y-10'
              }`}
            >
              {selectedImages.map((img) => (
                <div 
                  key={img.id} 
                  className="bg-white/20 backdrop-blur-md px-6 py-3 rounded-full border border-white/30 animate-fadeIn"
                  style={{animationDelay: `${selectedImages.indexOf(img) * 0.1}s`}}
                >
                  <span className="text-3xl font-bold text-white drop-shadow-md">
                    #{img.main_keyword}
                  </span>
                </div>
              ))}
            </div>
            
            {/* 검색 버튼 - 선택된 이미지가 있을 때만 표시 */}
            <div 
              className={`transition-all duration-700 ease-in-out ${
                selectedImages.length > 0 ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-10'
              }`}
              style={{transitionDelay: selectedImages.length > 0 ? '0.3s' : '0s'}}
            >
              <button
                onClick={handleSearch}
                className="bg-white text-emerald-900 font-bold py-5 px-16 rounded-full border-2 border-white/70 transition-all duration-300 hover:scale-105 shadow-xl text-3xl hover:bg-emerald-50"
              >
                Search
              </button>
            </div>
            
            {/* 선택된 이미지가 없을 때 안내 메시지 */}
            <div 
              className={`text-white text-xl transition-all duration-500 ${
                selectedImages.length === 0 ? 'opacity-100' : 'opacity-0 absolute -z-10'
              }`}
            >
              이미지를 선택하여 관심사를 추가해보세요
            </div>
          </div>
        </div>
      )}
      
      <div className="relative z-20 w-full">
        <div className="max-w-[1200px] mx-auto">
          {/* 기존 제목과 설명 (검색 모드가 아닐 때만 표시) */}
          {!isSearchMode && (
            <div className="absolute z-30 pl-8 max-w-[600px] space-y-6">
              <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">
                  {profile.nickname ? `${profile.nickname}의 무드보드` : 'My 무드보드'}
                </h1>
              </div>
              <div className="text-gray-500 text-base leading-relaxed mt-2">
                {profile.description || '나만의 알고리즘 프로필을 생성해보세요.'}
              </div>
              <div className="flex gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 px-4 bg-blue-500 text-white hover:bg-blue-600 flex items-center gap-2"
                  onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                >
                  {isEditing ? (
                    <>
                      <Save className="h-4 w-4" />
                      저장
                    </>
                  ) : (
                    <>
                      <Edit2 className="h-4 w-4" />
                      편집
                    </>
                  )}
                </Button>
                
                {/* 별명 생성 버튼 */}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 px-4 bg-purple-500 text-white hover:bg-purple-600 flex items-center gap-2"
                  onClick={generateUserProfile}
                  disabled={isGeneratingProfile}
                >
                  {isGeneratingProfile ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      생성 중...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      별명 생성하기
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          <div className="relative w-[1000px] h-[800px] mx-auto mt-8">
            <DndContext onDragEnd={handleDragEnd}>
              {images.map((image) => (
                <div
                  key={image.id}
                  className={`transition-all duration-500 ${
                    isEditing || visibleImageIds.has(image.id)
                      ? 'opacity-100 scale-100'
                      : 'opacity-0 scale-95 pointer-events-none'
                  }`}
                >
                  <DraggableImage
                    image={image}
                    position={positions[image.id]}
                    isEditing={isEditing && !isSearchMode}
                    positions={positions}
                    frameStyle={image.desired_self ? 'star' : (frameStyles[image.id] || 'healing')}
                    onFrameStyleChange={handleFrameStyleChange}
                    onImageChange={handleImageChange}
                    onImageSelect={handleImageSelect}
                    isSelected={selectedImages.some(img => img.id === image.id)}
                    isSearchMode={isSearchMode}
                    onImageDelete={handleImageDelete}
                  />
                </div>
              ))}
            </DndContext>
          </div>

          {/* 플로팅 검색 버튼 (토글 기능 추가) */}
          <div className="fixed top-32 right-8 z-50 group">
            <button
              onClick={toggleSearchMode}
              className={`w-16 h-16 ${
                isSearchMode ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'
              } text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110`}
              aria-label={isSearchMode ? '검색 모드 종료' : '검색하기'}
            >
              <Search className="w-7 h-7" />
            </button>
            <div className="absolute right-0 top-full mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg whitespace-nowrap text-sm">
                {isSearchMode 
                  ? '검색 모드를 종료하고 내 프로필로 돌아갑니다' 
                  : '나와 비슷한 관심사를 가진 사람의 알고리즘 프로필을 찾아보세요!'}
              </div>
              <div className="absolute -top-1 right-6 w-2 h-2 bg-gray-900 transform rotate-45" />
            </div>
          </div>

          {/* 히스토리 슬라이더 (검색 모드가 아닐 때만 표시) */}
          {histories.length > 0 && !isEditing && !isSearchMode && (
            <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 w-[60%] max-w-[500px] bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <div className="flex flex-col">
                  <h3 className="text-base sm:text-lg font-semibold">무드보드 히스토리</h3>
                  <p className="text-xs sm:text-sm text-gray-500 mt-1">
                    {currentHistoryIndex === 0 ? "처음 히스토리" : 
                     currentHistoryIndex === histories.length - 1 ? "마지막 히스토리" :
                     new Date(histories[currentHistoryIndex].timestamp).toLocaleString('ko-KR', {
                       month: 'long',
                       day: 'numeric',
                       hour: '2-digit',
                       minute: '2-digit'
                     })}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePlayHistory}
                  disabled={isPlaying}
                  className="flex items-center gap-2 text-xs sm:text-sm"
                >
                  {isPlaying ? (
                    <span className="animate-pulse">재생중...</span>
                  ) : (
                    <span>히스토리 재생</span>
                  )}
                </Button>
              </div>

              {/* 타임라인 슬라이더 */}
              <div className="relative w-full h-1 sm:h-1 bg-gray-100 rounded-full">
                <div 
                  className="absolute top-1/2 left-0 w-full h-0.5 bg-blue-200 -translate-y-1/2"
                  style={{
                    width: `${(currentHistoryIndex / (histories.length - 1)) * 100}%`
                  }}
                />
                <div className="absolute top-0 left-0 w-full flex items-center justify-between px-1">
                  {histories.map((history, index) => (
                    <button
                      key={history.timestamp}
                      className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full transition-all -mt-0.5 sm:-mt-1 relative group ${
                        currentHistoryIndex === index 
                          ? 'bg-blue-500 scale-125' 
                          : index < currentHistoryIndex
                          ? 'bg-blue-200'
                          : 'bg-gray-300 hover:bg-gray-400'
                      }`}
                      onClick={() => handleHistoryClick(index)}
                    >
                      <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 whitespace-nowrap text-[10px] sm:text-xs font-medium bg-gray-800 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                        {index === 0 ? "처음 히스토리" : 
                         index === histories.length - 1 ? "마지막 히스토리" :
                         new Date(history.timestamp).toLocaleString('ko-KR', {
                           month: 'long',
                           day: 'numeric',
                           hour: '2-digit',
                           minute: '2-digit'
                         })}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 컬러 팔레트 보드 (편집 모드일 때만 표시) */}
      {isEditing && !isSearchMode && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 w-auto bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-6 z-50">
          <div className="flex flex-col items-center gap-4">
            <h3 className="text-lg font-semibold text-gray-800">배경 색상 설정</h3>
            <div className="flex items-center gap-3">
              {colorOptions.map((color) => (
                <button
                  key={color.class}
                  onClick={() => handleBgColorChange(color.class)}
                  className={`
                    w-12 h-12 rounded-xl ${color.class} transition-all duration-300
                    hover:scale-110 shadow-md hover:shadow-lg
                    ${bgColor === color.class ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
                    relative group
                  `}
                >
                  <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 
                    bg-gray-900 text-white text-xs py-1 px-2 rounded opacity-0 
                    group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {color.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
} 