
import { setReflectionData_searched } from "@/app/utils/save/saveReflection";
import { MousePointer2Icon, MousePointerClick } from "lucide-react";
import React, { useState } from "react";

interface SearchModeUIProps {
    isSearchMode: boolean;
    selectedImage: any;
    selectedImages: any[];
    handleSearch: () => void;
    toggleSearchMode: () => void;
    setIsSearchMode: (value: boolean) => void;
}

const SearchModeUI: React.FC<SearchModeUIProps> = ({
    isSearchMode,
    selectedImage,
    selectedImages,
    handleSearch,
    toggleSearchMode,
    setIsSearchMode,
    }) => {
    if (!isSearchMode) return null;

    return (
    <>
        {/* 검색 모드일 때 배경 그라데이션 추가 */}
        <div className="absolute inset-0 overflow-hidden -z-10 bg-[#333947] transition-all duration-1000 ease-in-out">
            <div className="absolute -top-[40%] -left-[10%] w-[90%] h-[60%] rounded-full bg-[#B3D4FF] blur-[120px] animate-blob" />
            {/*<div className="absolute -bottom-[30%] -right-[10%] w-[70%] h-[60%] rounded-full bg-[#6B7F99] blur-[120px] animate-blob animation-delay-20" />*/}
            <div className="absolute top-[20%] right-[20%] w-[60%] h-[60%] rounded-full bg-[#6179A7] blur-[120px] animate-blob animation-delay-200" />
        </div>

        {/* 키워드 태그들과 검색 버튼을 화면 하단에 고정 */}
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-40 w-full">
            <div className="flex flex-col items-center gap-6 transition-all duration-500">
                
                {/* 검색 버튼 - 선택된 이미지가 있을 때만 표시 */}
                <div className="flex flex-col items-center gap-4 ">
                    {selectedImages.length === 0 ? (
                    <div    
                        className={`flex transition-all duration-700 ease-in-out`}
                        style={{transitionDelay: selectedImages.length > 0 ? '0.3s' : '0s'}}
                    >
                        <div className="flex flex-col items-center gap-2 text-white text-sm mb-2">
                            <MousePointerClick className="w-10 h-10 animate-pulse" />
                        새롭게 탐색하고 싶은 키워드의 이미지를 선택해주세요.
                        </div>
                        
                    </div>
                    ):(
                        <div className="flex flex-row gap-4 items-end">
                        {selectedImages.map((img) => (
                            <div 
                                key={img.id} 
                                className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-full  animate-fadeIn"
                                style={{animationDelay: `${selectedImages.indexOf(img) * 0.1}s`}}
                            >
                                <span className="text-md font-bold text-white drop-shadow-md">
                                #{img.main_keyword}
                                </span>
                            </div>
                            ))}
                        </div>
                    
                    )}
                    <button
                        onClick={()=>{
                            handleSearch();
                            setReflectionData_searched();
                        }}
                        className="bg-white text-black font-bold py-3 px-10 rounded-full 
                        transition-all duration-300 hover:scale-105 shadow-2xl text-xl hover:bg-black hover:text-white"
                        >
                        탐색하기
                    </button>
                </div>
            </div>
        </div>
        </>
    );
};

export default SearchModeUI; 