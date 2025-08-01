"use client";

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Search } from "lucide-react";


import { profiles, userImages } from '@/app/others_profile/dummy-data';
import { ImageData } from '@/app/types/profile';
import CardStack3D from './SearchMode/showCard';      

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [keywords, setKeywords] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 유상님✅ 더미 데이터로 가져온 이미지들 그냥 검색 결과에 다 ImageData[] 형태로 저장
  const [searchResults, setSearchResults] = useState<ImageData[]>([]);
  const [isSearchMode, setIsSearchMode] = useState(true);
  const [show, setShow] = useState(true); // 안내 문구 표시 여부
    
  useEffect(() => {
    // URL에서 키워드 파라미터 가져오기
    const keywordParam = searchParams.get('keywords');
    if (keywordParam) {
      const keywordArray = keywordParam.split(',');
      setKeywords(keywordArray);
      
      // 여기서 검색 로직 구현
      performSearch(keywordArray);
    } else {
      setIsLoading(false);
    }
  }, [searchParams]);

  // 검색 로직 수정 - 필터링 없이 모든 프로필 표시
  const performSearch = async (searchKeywords: string[]) => {
    setIsLoading(true);
    try {
      // 필터링 로직 주석 처리하고 모든 더미 프로필 표시
      setTimeout(() => {
        
        setSearchResults(profiles.flatMap(profile => userImages[profile.id] || []));
        setIsLoading(false);
      }, 1500); // 로딩 효과를 위해 지연 시간 유지
      
    } catch (error) {
      console.error('검색 오류:', error);
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen overflow-y-hidden">
      {isSearchMode && (
        <div className="min-h-full fixed inset-0 overflow-hidden -z-10 bg-white">
          <div className="absolute -bottom-[10%] -left-[10%] w-[90%] h-[60%] rounded-full bg-[#B3D4FF] blur-[120px] animate-blob" />
          <div className="absolute -bottom-[30%] -right-[10%] w-[70%] h-[60%] rounded-full bg-[#6B7F99] blur-[120px] animate-blob animation-delay-20" />
          <div className="absolute -bottom-[20%] -right-[20%] w-[60%] h-[60%] rounded-full bg-[#6179A7] blur-[120px] animate-blob animation-delay-200" />
        </div>
      )}

      <div className="ml-24 mr-20 mx-auto p-4 mt-20">
        {/* 헤더 */}
        <div className="flex items-center mb-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
                className="text-black hover:bg-white/10"
              >
              <ArrowLeft className="h-4 w-4" />
              
            </Button>
          <h1 className="text-2xl font-bold text-black"> 탐색 결과: {searchResults.length}개</h1>
        </div>
        {show && (
        <div className="fixed top-22 right-10 bg-white/90 backdrop-blur-lg text-black px-7 py-3 rounded-full shadow-xl flex items-center min-w-[420px] max-w-[600px] z-50 animate-fadeIn">
          <span className="text-base flex items-center p-2 pr-3 pl-3">
            <img src="/images/cokieIcon.svg" alt="click" className="w-4 h-4 mr-4" />
            더 궁금하다면 이미지를 클릭해 자화상 전체를 구경할 수 있어요.
          </span>
          <button
            className="flex items-center justify-center top-2 right-3 text-black font-bold text-lg hover:text-blue-400 transition  
            rounded-full w-8 h-8 flex p-2" 
            onClick={() => setShow(false)}
            aria-label="안내 닫기"
            type="button"
          >
            ×
          </button>
        </div>
        )}
        {/* 검색 키워드 표시 */}
        <div className="mb-4 flex flex-row items-center gap-2">
          <div className="flex flex-wrap gap-3">
            
          </div>
          
        </div>
        
        {/* 검색 결과 */}
        <div className="mt-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 border-4 border-black/20 border-t-black rounded-full animate-spin mb-4"></div>
              <p className="text-black text-xl"> 당신과 비슷한 취향의 알고리즘 정체성 키워드를 찾고 있어요...</p>
            </div>
          ) : searchResults.length > 0 ? (
            <>
            <h2 className="text-lg text-black/80  font-bold mb-1 flex flex-row items-center gap-2 ">
            {keywords.map((keyword, index) => (
              <div 
                key={index}
                className="bg-black/80 backdrop-blur-md px-4 py-1 rounded-full text-xs"
              >
                <span className="text-sm font-bold text-white">
                  #{keyword}
                </span>
              </div>
            ))}
            
            과 비슷한 취향을 가진 사람들이 즐겨 보는 키워드들이에요. <br/>
            </h2>
            <h2 className="text-lg text-black/80 font-bold mb-4 flex flex-row items-center gap-1 ">
              비슷한 취향의 사람들이 빠져 있는 키워드들을 살펴보며, 나와 닮은 점이나 새로운 관점을 발견해보세요.
            </h2>
            
            <CardStack3D 
            cards={searchResults}
            searchKeyword={keywords[0] || ''} // 첫번째 키워드만 사용
            />
            </> 
          ) : (
            <div className="text-center py-20">
              <Search className="w-16 h-16 text-black/40 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-black mb-2">아쉽게도 비슷한 취향을 가진 유저가 없습니다.</h3>
              <p className="text-black/70">다른 관심사를 선택해보거나 나중에 다시 시도해보세요</p>
            </div>
          )}
        </div>
        
      </div>
    </main>
  );
}
