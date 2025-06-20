import React, { useState, useEffect } from 'react';
import { useDraggableImage } from './Hooks/Drag/useDraggableImage';
import { Sheet, SheetTrigger } from '@/components/ui/sheet';
import { RefreshCw, AlertTriangle, Trash2 } from 'lucide-react';

//refactoring
import ClusterDetailPanel from "../Modal/ClusterDetailPanel";
import ImageResearchModal from "./ImageRe-searchModal";
import { useImageSearch } from "./Hooks/Image/useImageResearch_naver";
import { useImageFrame } from "./Hooks/Frame/useImageFrame";

// YouTube IFrame API 타입 선언 (TS 에러 방지)
declare global {
    interface Window {
        YT: any;
        onYouTubeIframeAPIReady: (() => void) | undefined;
    }
}

// VideoData 타입 추가
export type VideoData = {
    title: string;
    embedId: string;
};
// DraggableImageProps 타입 정의 (필요에 따라 수정)
export interface DraggableImageProps {
    image: any;
    position?: { x: number; y: number };
    isEditing: boolean;
    frameStyle: string;
    onFrameStyleChange: (id: string, style: string) => void;
    onImageChange: (id: string, src: string, keyword: string) => void;
    onImageSelect: (image: any) => void;
    isSelected: boolean;
    isSearchMode: boolean;
    onImageDelete: (id: string) => void;
    isOwner?: boolean;
    ownerId?: string;
}

// 모양별 정보 배열
const frameOptions = [
  { value: 'normal', icon: '⬛️', label: '나의 기본 관심사' },
  //{ value: 'inspiration', icon: '⬡', label: '영감을 주는 영상' },
  //{ value: 'people', icon: '⚪️', label: '내가 좋아하는 사람' },
    //{ value: 'interest', icon: '🔶', label: '나만의 관심사' },
  //{ value: 'cloud', icon: '🌥️', label: '클라우드' },
  //{ value: 'heart', icon: '💖', label: '하트' },
  //{ value: 'pentagon', icon: '🔺', label: '펜타곤' },
  //{ value: 'star', icon: '⭐️', label: '별' },
  { value: 'pill', icon: '💊', label: '나에게 힐링이 되는 영상' },
  //{ value: 'cokie', icon: '🍪', label: '쿠키' },
];

const DraggableImage: React.FC<DraggableImageProps> = ({ 
    image, 
    position, 
    isEditing,
    frameStyle,
    onFrameStyleChange,
    onImageChange,
    onImageSelect,
    isSelected,
    isSearchMode,
    isOwner = true,
    ownerId,
    onImageDelete,
}) => {
    const { attributes, listeners, setNodeRef, style } = useDraggableImage(
        image.id,
        isEditing,
        position,
        image.rotate
    );

    const [imageLoadError, setImageLoadError] = useState(false);
    const [showImageModal, setShowImageModal] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [showThumbnailModal, setShowThumbnailModal] = useState(false);
    const [activeTab, setActiveTab] = useState<string>('search');
    const [showDeleteTooltip, setShowDeleteTooltip] = useState(false);

    // desired_self 여부에 따라 실제 크기 조절에 사용될 가중치 계산
    const effectiveSizeWeight = image.desired_self ? image.sizeWeight : (image.sizeWeight || 0.1) * 10;

    // effectiveSizeWeight를 기반으로 폰트 크기 계산
    const minFontSize = 10;
    const maxFontSize = 30;
    // effectiveSizeWeight의 예상 범위
    const minWeight = 0.15;
    const maxWeight = 1.5;

    const clamp = (num: number, min: number, max: number) => Math.min(Math.max(num, min), max);
    
    // 가중치를 제한하고 0-1 범위로 정규화
    const clampedWeight = clamp(effectiveSizeWeight, minWeight, maxWeight);
    const normalizedRatio = (clampedWeight - minWeight) / (maxWeight - minWeight);

    // 제곱근을 사용하여 작은 값의 차이를 증폭
    const curvedRatio = Math.sqrt(normalizedRatio);
    
    const fontSize = minFontSize + curvedRatio * (maxFontSize - minFontSize);

    useEffect(() => {
        // src가 없거나 logo.png를 포함하는 경우, 유효하지 않은 것으로 간주합니다.
        const isInvalid = !image.src || image.src.includes('/images/logo.png');
        if (isInvalid) {
            const target = document.getElementById(image.id) as HTMLImageElement;
            if (target) {
                target.src = '/images/default_image.png';
            }
            setImageLoadError(true); // 이미지 로드 에러 상태 설정
        }
        // 이 효과는 이미지 소스가 바뀔 때마다 실행됩니다.
    }, [image.src, image.id, image.main_keyword, onImageChange]);

    const {
        alternativeImages,
        isLoadingImages,
        fetchAlternativeImages,
        handleImageSelect,
        setAlternativeImages,
    } = useImageSearch(image, showImageModal, onImageChange, setShowImageModal);

    const {
        frameStyle: updatedFrameStyle,
        getClipPath,
        getFrameStyle,
        handleFrameStyleChange,
    } = useImageFrame(frameStyle, image, onFrameStyleChange);

    // 버튼에서 직접 string 값을 넘길 수 있도록 래핑
    const handleFrameStyleChangeByValue = (value: string) => {
        // select 이벤트 mock 객체 생성
        handleFrameStyleChange({ target: { value } } as React.ChangeEvent<HTMLSelectElement>);
    };

    return (
    <>
        {/* 이미지 띄우기 */}
        <Sheet>
            <div
                ref={setNodeRef}
                data-id={image.id}
                style={{
                ...style,
                position: 'absolute',
                width: image.width * (image.desired_self ? image.sizeWeight : image.sizeWeight * 10),
                height: (image.height + 80) * (image.desired_self ? image.sizeWeight: image.sizeWeight * 10),
                touchAction: 'none',
                zIndex: isSelected ? 30 : 10,
                transition: isEditing ? 'none' : 'transform 0.8s ease-in-out',
                }}
                className={`group ${isEditing ? "cursor-move" : isSearchMode ? "cursor-pointer" : ""}`}
            >
                {/* 이미지 */}
                <div className={`absolute inset-0 transform ${!isEditing && isSearchMode ? 'transition-all duration-300 hover:scale-110 hover:z-30' : ''} ${isEditing ? 'pointer-events-none' : ''}`}
                >
                    {/* 메인키워드 */}
                    <div 
                        className="absolute -top-10 z-20 whitespace-nowrap"
                        style={{
                        fontSize: `${fontSize}px`,
                        }}
                    >
                        <div 
                        className="px-8 py-4"
                        >
                        
                        <span className={`font-bold ${image.desired_self ? 'text-indigo-600' : 'text-gray-800'}`}>
                            #{image.main_keyword}
                        </span>
                        </div>
                    </div>

                    {/* 이미지 */}
                    <SheetTrigger asChild>
                        <div 
                        className={`relative w-full h-[calc(100%-40px)] ${!isEditing && !isSearchMode ? 'cursor-pointer' : ''} ${isEditing ? 'pointer-events-none' : ''} 
                        ${isSelected 
                            ? 'ring-4 ring-white ring-opacity-70 shadow-xl rounded-lg' 
                            : ''
                        }`}
                        >
                        <div
                            style={{
                                ...getClipPath(),
                                filter: image.desired_self && !isSelected ? 'drop-shadow(2px 4px 5px rgba(0,0,0,0.25)) drop-shadow(0px 0px 7px #818cf8)' : 'none',
                                // Webkit-specific property for better compatibility
                                WebkitFilter: image.desired_self && !isSelected ? 'drop-shadow(2px 4px 5px rgba(0,0,0,0.25)) drop-shadow(0px 0px 7px #818cf8)' : 'none'
                            }}
                            className={`relative w-full h-full ${getFrameStyle()} overflow-hidden`}
                        >
                            <img
                                src={imageLoadError ? "/images/default_image.png" : image.src}
                                alt={image.main_keyword}
                                className={`w-full h-full object-cover shadow-lg transition-transform duration-300 ${!isEditing && isSearchMode ? 'group-hover:scale-105' : ''}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isEditing && isSearchMode) {
                                        onImageSelect(image);
                                    } else if (!isEditing && !isSearchMode) {
                                        setShowDetails(true);
                                    }
                                }}
                                onError={() => setImageLoadError(true)}
                            />
                            
                        </div>
                        
                        {/* 키워드를 이미지 하단에 배치 
                        <div className="absolute bottom-0.5 left-0 right-0 flex flex-wrap gap-1 justify-center items-center p-1">
                            {image.keywords.map((keyword: string, idx: number) => (
                            <span
                                key={idx}
                                className="inline-block px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm rounded-full shadow-sm transition-colors"
                            >
                                #{keyword}
                            </span>
                            ))}
                        </div>
                        
                        */}
                        
                        </div>
                    </SheetTrigger>
                </div>
                
                {/* 편집 모드-이미지 변경하기*/}
                {isEditing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    {image.desired_self ? (
                    <button 
                        className="mb-10 z-[70] flex items-center justify-center gap-1.5 py-2 px-4 bg-red-500/90 text-white 
                        backdrop-blur-sm rounded-full hover:bg-red-600 shadow-sm transition-colors pointer-events-auto relative"
                        onMouseEnter={() => setShowDeleteTooltip(true)}
                        onMouseLeave={() => setShowDeleteTooltip(false)}
                        onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // 실제 삭제 기능 실행
                        if (window.confirm('정말로 이 관심사를 삭제하시겠습니까?')) {
                            onImageDelete(image.id);
                        }
                        }}
                        onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        }}
                    >
                        {/* 툴크 */}
                        {showDeleteTooltip && (
                            <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-[100]">
                                내가 추가한 관심사 삭제하기
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
                            </div>
                        )}
                        <Trash2 className="h-4 w-4" />
                    </button>
                    ) : (
                    <button 
                        className="z-[60] group flex mb-10 items-center justify-center py-2 px-4 backdrop-blur-sm rounded-full 
                        hover:bg-white shadow-lg transition-all hover:scale-105 pointer-events-auto"
                        onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        }}
                    >
                        <RefreshCw 
                            className="h-4 w-4 group-hover:rotate-180 transition-transform duration-300 cursor-pointer" 
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setShowImageModal(true);
                            }}
                        />
                    </button>
                    )}
                </div>
                )}
                {/* 편집 모드-프레임 변경하기*/}
                {isEditing && (
                <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 z-40 pointer-events-auto flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    {!image.desired_self && (
                        <>
                        {frameOptions
                            .filter(opt => opt.value !== 'cokie') // cokie 옵션을 일반 이미지에서 제외
                            .map(opt => (
                            <button
                                key={opt.value}
                                className={`rounded-full text-sm px-2 py-1  rounded-full hover:bg-white shadow-lg transition-all hover:scale-105 z-20 pointer-events-auto 
                                    ${updatedFrameStyle === opt.value ? 'border-blue-400' : 'border-transparent'}`}
                                onClick={() => {
                                    handleFrameStyleChangeByValue(opt.value);
                                    onFrameStyleChange(image.id, opt.value);
                                }}
                                onMouseDown={e => e.stopPropagation()}
                                title={opt.label}
                                type="button"
                            >
                                <span>{opt.icon}</span>
                            </button>
                        ))}
                        </>
                    )}
                    
                </div>
                )}
                {/* 편집 모드-드래그 가능한 영역*/}
                {isEditing && (
                <div
                    className="absolute inset-0 z-50"
                    {...listeners}
                    {...attributes}
                />
                )}
            </div>
        </Sheet>

        {/* 이미지 새로 검색하기 모달 */}
        <ImageResearchModal
            open={showImageModal}
            onOpenChange={setShowImageModal}
            image={image}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            isLoadingImages={isLoadingImages}
            alternativeImages={alternativeImages}
            fetchAlternativeImages={fetchAlternativeImages}
            handleImageSelect={handleImageSelect}
            onImageChange={onImageChange}
            setShowThumbnailModal={setShowThumbnailModal}
        />

        {/*클러스터 상세 정보 패널 */}
        {showDetails && (
            <ClusterDetailPanel
                image={image}
                showDetails={showDetails}
                setShowDetails={setShowDetails}
                isEditing={isEditing}
                isOwner={isOwner}
                onImageSelect={onImageSelect}
                ownerId={ownerId} 
            />
        )}
    </> 
    );
}

export default DraggableImage;

