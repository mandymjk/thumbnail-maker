
// 상태 값
let selectedLayout = null;
let currentStep = "layout";
let selectedPhotos = []; // 선택한 사진 파일들을 저장
let imageOffsets = []; // 각 이미지의 드래그 offset 저장 [{x: 0, y: 0}, ...]
let imageScales = []; // 각 이미지의 확대/축소 배율 저장
let loadedImages = []; // 로드된 Image 객체들
let backgroundColor = "#ffffff"; // 배경색
let isDragging = false;
let dragImageIndex = -1;
let dragStartX = 0;
let dragStartY = 0;
let dragOffsetX = 0;
let dragOffsetY = 0;

// 핀치 줌 관련
let isPinching = false;
let initialPinchDistance = 0;
let initialScale = 1;
let pinchCenterX = 0; // 핀치 중심점 X (캔버스 좌표)
let pinchCenterY = 0; // 핀치 중심점 Y (캔버스 좌표)
let initialOffsetX = 0; // 핀치 시작 시 offset X
let initialOffsetY = 0; // 핀치 시작 시 offset Y

// 레이아웃별 사진 개수 제한
const layoutLimits = {
  A: { min: 1, max: 1 },
  B: { min: 2, max: 4 },
};

// DOM 요소
const layoutButtons = document.querySelectorAll(".layout-card");
const nextButton = document.getElementById("btn-next");
const setFloButton = document.getElementById("btn-set-flo");
const downloadButton = document.getElementById("btn-download");
const restartButton = document.getElementById("btn-restart");
const resultButtonsContainer = document.querySelector(".result-buttons");
const stepLayout = document.getElementById("step-layout");
const stepPhoto = document.getElementById("step-photo");
const appTitle = document.querySelector(".app-title");
const backButton = document.querySelector(".nav-icon");
const photoInput = document.getElementById("photo-input");
const photoCountText = document.getElementById("photo-count");
const photoTitle = document.getElementById("photo-title");
const photoPreview = document.getElementById("photo-preview");
const stepEdit = document.getElementById("step-edit");
const stepResult = document.getElementById("step-result");
const previewCanvas = document.getElementById("preview-canvas");
const resultCanvas = document.getElementById("result-canvas");
const bgColorPicker = document.getElementById("bg-color-picker");
const bgColorValue = document.getElementById("bg-color-value");

// 레이아웃 카드 클릭 시 선택 상태 토글
layoutButtons.forEach((btn) => {
  const selectLayout = () => {
    layoutButtons.forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedLayout = btn.dataset.layout;

    if (currentStep === "layout") {
      nextButton.disabled = false;
    }
  };
  
  // 클릭 이벤트
  btn.addEventListener("click", selectLayout);
  
  // 터치 이벤트 (모바일 지원)
  btn.addEventListener("touchend", (e) => {
    e.preventDefault();
    selectLayout();
  });
});

// "다음으로" 버튼 클릭 시
nextButton.addEventListener("click", () => {
  if (currentStep === "layout") {
    if (!selectedLayout) return;
    goToPhotoStep();
  } else if (currentStep === "photo") {
    if (!photoInput.files.length) return;
    goToEditStep();
  } else if (currentStep === "edit") {
    generateThumbnail();
    goToResultStep();
  }
});

// 뒤로가기 버튼
backButton.addEventListener("click", () => {
  if (currentStep === "photo") {
    // 사진 선택 화면 → 레이아웃 선택 화면
    // 사진 선택 정보 초기화
    selectedPhotos = [];
    photoInput.value = "";
    photoPreview.innerHTML = "";
    updatePhotoCount();
    
    // 편집/결과 화면 완전 초기화
    imageOffsets = [];
    loadedImages = [];
    imageRegions = [];
    const editCtx = previewCanvas.getContext("2d");
    editCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    const resultCtx = resultCanvas.getContext("2d");
    resultCtx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
    
    goToLayoutStep();
  } else if (currentStep === "edit") {
    // 편집 화면 → 사진 선택 화면
    // 편집 정보 초기화 (offset, 로드된 이미지)
    imageOffsets = [];
    loadedImages = [];
    imageRegions = [];
    isDragging = false;
    dragImageIndex = -1;
    
    // 캔버스 초기화
    const editCtx = previewCanvas.getContext("2d");
    editCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    
    // 결과 화면 완전 초기화
    const resultCtx = resultCanvas.getContext("2d");
    resultCtx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
    
    goToPhotoStep();
  } else if (currentStep === "result") {
    // 결과 화면 → 편집 화면
    // 결과 캔버스 초기화
    const ctx = resultCanvas.getContext("2d");
    ctx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
    
    goToEditStep();
  }
});

// 다시 만들기 버튼
restartButton.addEventListener("click", () => {
  restartFromBeginning();
});

// FLO 설정 버튼
setFloButton.addEventListener("click", () => {
  // FLO 내 리스트 페이지를 새 탭으로 열기
  const floUrl = "https://www.music-flo.com/storage/mylist";
  
  // 이미지를 다운로드하고 FLO 페이지 열기
  resultCanvas.toBlob((blob) => {
    // 1. 이미지를 다운로드
    const link = document.createElement("a");
    link.download = `flo-thumbnail-${Date.now()}.jpg`;
    link.href = resultCanvas.toDataURL("image/jpeg", 0.95);
    link.click();
    
    // 2. 잠시 후 FLO 페이지 열기
    setTimeout(() => {
      const message = `썸네일 이미지가 다운로드되었습니다!\n\n` +
                     `FLO 내 리스트 페이지로 이동합니다.\n` +
                     `리스트 편집 > 이미지 변경에서 다운로드한 이미지를 업로드하세요.`;
      
      if (confirm(message)) {
        window.open(floUrl, '_blank');
      }
    }, 500);
    
    // 3. 클립보드에도 복사 (편의 기능)
    try {
      navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]).then(() => {
        console.log("이미지가 클립보드에도 복사되었습니다.");
      }).catch(err => {
        console.log("클립보드 복사는 실패했지만 다운로드는 완료되었습니다.");
      });
    } catch (err) {
      console.log("클립보드 복사 기능을 사용할 수 없습니다.");
    }
  }, 'image/png');
});

// 다운로드 버튼
downloadButton.addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = `flo-thumbnail-${Date.now()}.jpg`;
  link.href = resultCanvas.toDataURL("image/jpeg", 0.95);
  link.click();
});

// 사진 선택 변경 시
photoInput.addEventListener("change", (e) => {
  if (!selectedLayout) return;

  const files = Array.from(e.target.files);
  const limits = layoutLimits[selectedLayout];

  // 최대 개수 초과 시 제한
  if (files.length > limits.max) {
    alert(`레이아웃 ${selectedLayout}는 최대 ${limits.max}장까지만 선택할 수 있어요.`);
    // 초과된 파일 제거
    const dt = new DataTransfer();
    files.slice(0, limits.max).forEach((file) => dt.items.add(file));
    photoInput.files = dt.files;
    selectedPhotos = Array.from(photoInput.files);
  } else {
    selectedPhotos = files;
  }

  updatePhotoPreview();
  updatePhotoCount();
  updateButtonState();
});

// 사진 미리보기 업데이트
function updatePhotoPreview() {
  photoPreview.innerHTML = "";

  selectedPhotos.forEach((file, index) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const item = document.createElement("div");
      item.className = "photo-preview-item";

      const img = document.createElement("img");
      img.src = e.target.result;
      img.alt = file.name;

      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-btn";
      removeBtn.textContent = "×";
      removeBtn.setAttribute("aria-label", "이미지 제거");
      removeBtn.onclick = () => removePhoto(index);

      item.appendChild(img);
      item.appendChild(removeBtn);
      photoPreview.appendChild(item);
    };
    reader.readAsDataURL(file);
  });
}

// 사진 제거
function removePhoto(index) {
  selectedPhotos.splice(index, 1);

  // input 파일 목록도 업데이트
  const dt = new DataTransfer();
  selectedPhotos.forEach((file) => dt.items.add(file));
  photoInput.files = dt.files;

  updatePhotoPreview();
  updatePhotoCount();
  updateButtonState();
}

// 사진 개수 텍스트 업데이트
function updatePhotoCount() {
  const count = selectedPhotos.length;
  if (!selectedLayout) {
    photoCountText.textContent = `${count}개 선택됨`;
    return;
  }

  const limits = layoutLimits[selectedLayout];
  let statusText = `${count}개 선택됨`;

  // 조건에 맞지 않을 때 안내 메시지 추가
  if (count < limits.min) {
    statusText += ` (최소 ${limits.min}장 필요)`;
    photoCountText.style.color = "#ff4444"; // 빨간색으로 경고
  } else if (count > limits.max) {
    statusText += ` (최대 ${limits.max}장까지 가능)`;
    photoCountText.style.color = "#ff4444";
  } else {
    photoCountText.style.color = "#9093a0"; // 정상 상태는 회색
  }

  photoCountText.textContent = statusText;
}

// 버튼 상태 업데이트
function updateButtonState() {
  if (!selectedLayout) return;

  const limits = layoutLimits[selectedLayout];
  const count = selectedPhotos.length;
  const isValid = count >= limits.min && count <= limits.max;

  nextButton.disabled = !isValid;
}

// 가이드 텍스트 업데이트 (제목에 큰 글자로 표시)
function updatePhotoGuide() {
  if (!selectedLayout) return;

  const limits = layoutLimits[selectedLayout];
  if (limits.min === limits.max) {
    photoTitle.textContent = `사진을 ${limits.min}장 선택하세요`;
  } else {
    photoTitle.textContent = `사진을 ${limits.min}~${limits.max}장 선택하세요`;
  }
}

function goToPhotoStep() {
  currentStep = "photo";
  
  // 모든 step에서 step-active 제거
  stepLayout.classList.remove("step-active");
  stepPhoto.classList.remove("step-active");
  stepEdit.classList.remove("step-active");
  stepResult.classList.remove("step-active");
  
  // 사진 선택 화면만 활성화
  stepPhoto.classList.add("step-active");
  appTitle.textContent = "사진 선택";

  // 가이드 텍스트 업데이트
  updatePhotoGuide();

  // 사진 선택 화면으로 돌아올 때는 기존 선택 내용 유지
  // (뒤로가기에서 초기화하므로 여기서는 유지)
  updatePhotoCount();
  updateButtonState();

  // 버튼 표시 설정
  nextButton.style.display = "flex";
  nextButton.textContent = "이미지로 만들기";
  resultButtonsContainer.style.display = "none"; // 결과 버튼 컨테이너 숨김
  backButton.style.display = "block"; // 뒤로가기 버튼 표시
  backButton.style.visibility = "visible"; // visibility 복원
  
  // 헤더 spacer 표시 (타이틀 중앙 정렬)
  const headerSpacer = document.getElementById("header-spacer");
  if (headerSpacer) {
    headerSpacer.style.display = "block";
    headerSpacer.style.visibility = "visible";
  }
  
  // 화면 최상단으로 스크롤
  window.scrollTo(0, 0);
}

function goToLayoutStep() {
  currentStep = "layout";
  
  // 모든 step에서 step-active 제거
  stepLayout.classList.remove("step-active");
  stepPhoto.classList.remove("step-active");
  stepEdit.classList.remove("step-active");
  stepResult.classList.remove("step-active");
  
  // 레이아웃 선택 화면만 활성화
  stepLayout.classList.add("step-active");
  appTitle.textContent = "레이아웃 선택";
  
  // 버튼 표시 설정
  nextButton.style.display = "flex";
  nextButton.textContent = "다음으로";
  nextButton.disabled = !selectedLayout;
  resultButtonsContainer.style.display = "none"; // 결과 버튼 컨테이너 숨김
  backButton.style.visibility = "hidden"; // 공간은 유지하고 안보이게만
  
  // 헤더 spacer 표시 (타이틀 중앙 정렬)
  const headerSpacer = document.getElementById("header-spacer");
  if (headerSpacer) {
    headerSpacer.style.display = "block";
    headerSpacer.style.visibility = "visible";
  }
}

// 처음 화면으로 돌아가기 (모든 상태 초기화)
function restartFromBeginning() {
  // 상태 초기화
  selectedLayout = null;
  selectedPhotos = [];
  imageOffsets = [];
  imageScales = [];
  loadedImages = [];
  imageRegions = [];
  isDragging = false;
  dragImageIndex = -1;
  backgroundColor = "#ffffff"; // 배경색 초기화
  
  // 파일 입력 초기화
  photoInput.value = "";
  photoPreview.innerHTML = "";
  
  // 레이아웃 선택 초기화
  layoutButtons.forEach((btn) => btn.classList.remove("selected"));
  
  // 캔버스 초기화
  const editCtx = previewCanvas.getContext("2d");
  editCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  const resultCtx = resultCanvas.getContext("2d");
  resultCtx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
  
  // 화면 이동
  goToLayoutStep();
}

// 편집 화면으로 이동
function goToEditStep() {
  currentStep = "edit";
  
  // 모든 step에서 step-active 제거
  stepLayout.classList.remove("step-active");
  stepPhoto.classList.remove("step-active");
  stepEdit.classList.remove("step-active");
  stepResult.classList.remove("step-active");
  
  // 편집 화면만 활성화
  stepEdit.classList.add("step-active");
  appTitle.textContent = "썸네일 편집";

  // 버튼 표시 설정
  nextButton.style.display = "flex";
  nextButton.textContent = "썸네일 생성하기";
  nextButton.disabled = false;
  resultButtonsContainer.style.display = "none"; // 결과 버튼 컨테이너 숨김
  backButton.style.display = "block"; // 뒤로가기 버튼 표시
  backButton.style.visibility = "visible"; // visibility 복원
  
  // 헤더 spacer 표시 (타이틀 중앙 정렬)
  const headerSpacer = document.getElementById("header-spacer");
  if (headerSpacer) {
    headerSpacer.style.display = "block";
    headerSpacer.style.visibility = "visible";
  }

  // 편집 화면으로 돌아올 때는 기존 offset 유지
  // 이미지 로드 및 미리보기 렌더링
  if (loadedImages.length === 0) {
    loadImagesForEdit();
  } else {
    renderPreview();
  }
  
  // 화면 최상단으로 스크롤
  window.scrollTo(0, 0);
}

// 결과 화면으로 이동
function goToResultStep() {
  currentStep = "result";
  
  // 모든 step에서 step-active 제거
  stepLayout.classList.remove("step-active");
  stepPhoto.classList.remove("step-active");
  stepEdit.classList.remove("step-active");
  stepResult.classList.remove("step-active");
  
  // 결과 화면만 활성화
  stepResult.classList.add("step-active");
  appTitle.textContent = "썸네일 완성";

  // 버튼 표시 변경
  nextButton.style.display = "none"; // 다음으로 버튼 숨김
  resultButtonsContainer.style.display = "flex"; // 결과 버튼 컨테이너 표시
  
  // 뒤로가기 버튼 숨김 (visibility로 공간은 유지), spacer도 표시
  backButton.style.visibility = "hidden"; // display 대신 visibility 사용
  const headerSpacer = document.getElementById("header-spacer");
  if (headerSpacer) {
    headerSpacer.style.display = "block";
    headerSpacer.style.visibility = "visible";
  }
  
  // 화면 최상단으로 스크롤
  window.scrollTo(0, 0);
}

// 이미지 영역 정보 저장 (드래그를 위해)
let imageRegions = [];

// 미리보기 렌더링 (편집 화면)
function renderPreview() {
  if (loadedImages.length === 0) {
    loadImagesForEdit();
    return;
  }
  
  const ctx = previewCanvas.getContext("2d");
  const size = 1080;
  previewCanvas.width = size;
  previewCanvas.height = size;

  // 배경색 적용
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, size, size);

  // 레이아웃에 맞게 이미지 배치
  drawLayout(ctx, size, loadedImages, true);
}

// 편집 화면용 이미지 로드
function loadImagesForEdit() {
  loadedImages = [];
  imageOffsets = [];
  imageScales = [];
  let loadedCount = 0;

  selectedPhotos.forEach((file, index) => {
    const img = new Image();
    img.onload = () => {
      loadedImages.push(img);
      imageOffsets.push({ x: 0, y: 0 }); // 초기 offset
      imageScales.push(1.0); // 초기 스케일 1.0 (원본 크기)
      loadedCount++;
      if (loadedCount === selectedPhotos.length) {
        renderPreview();
      }
    };
    img.src = URL.createObjectURL(file);
  });
}

// 최종 썸네일 생성 (결과 화면)
function generateThumbnail() {
  const ctx = resultCanvas.getContext("2d");
  const size = 1080;
  resultCanvas.width = size;
  resultCanvas.height = size;

  // 편집 화면의 캔버스를 그대로 복사
  ctx.drawImage(previewCanvas, 0, 0, size, size);
}

// 레이아웃에 맞게 이미지 그리기 (cover 방식으로 crop, 드래그 offset 반영)
function drawLayout(ctx, size, images, isPreview = false) {
  imageRegions = []; // 영역 정보 초기화

  if (selectedLayout === "A") {
    // 레이아웃 A: 사진 1장, 전체 화면
    if (images[0]) {
      const img = images[0];
      const offset = isPreview ? imageOffsets[0] : { x: 0, y: 0 };
      const userScale = isPreview ? (imageScales[0] || 1.0) : 1.0;
      
      // 클리핑 영역 설정
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, size, size);
      ctx.clip();
      
      // cover 방식: 더 짧은 쪽에 맞춰서 crop
      const scale = Math.max(size / img.width, size / img.height) * userScale;
      const scaledWidth = img.width * scale;
      const scaledHeight = img.height * scale;
      
      // 이미지 그리기 위치 (offset 적용)
      const drawX = (size - scaledWidth) / 2 + offset.x;
      const drawY = (size - scaledHeight) / 2 + offset.y;
      
      ctx.drawImage(img, drawX, drawY, scaledWidth, scaledHeight);
      ctx.restore();
      
      if (isPreview) {
        imageRegions.push({ x: 0, y: 0, width: size, height: size, imageIndex: 0 });
      }
    }
  } else if (selectedLayout === "B") {
    // 레이아웃 B: 사진 2~4장, 그리드로 배치
    const count = images.length;
    if (count === 2) {
      // 2장: 위아래로 나눔
      const cellHeight = size / 2;
      images.forEach((img, i) => {
        const offset = isPreview ? imageOffsets[i] : { x: 0, y: 0 };
        const userScale = isPreview ? (imageScales[i] || 1.0) : 1.0;
        const regionY = i * cellHeight;
        
        // 클리핑 영역 설정
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, regionY, size, cellHeight);
        ctx.clip();
        
        // cover 방식: 더 짧은 쪽에 맞춰서 crop
        const scale = Math.max(size / img.width, cellHeight / img.height) * userScale;
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;
        
        // 이미지 그리기 위치
        const drawX = (size - scaledWidth) / 2 + offset.x;
        const drawY = regionY + (cellHeight - scaledHeight) / 2 + offset.y;
        
        ctx.drawImage(img, drawX, drawY, scaledWidth, scaledHeight);
        ctx.restore();
        
        if (isPreview) {
          imageRegions.push({ x: 0, y: regionY, width: size, height: cellHeight, imageIndex: i });
        }
      });
    } else if (count === 3) {
      // 3장: 위 1장, 아래 2장
      const topHeight = size / 3;
      const bottomHeight = (size * 2) / 3;
      const bottomCellWidth = size / 2;

      // 위 1장
      const topImg = images[0];
      const topOffset = isPreview ? imageOffsets[0] : { x: 0, y: 0 };
      const topUserScale = isPreview ? (imageScales[0] || 1.0) : 1.0;
      
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, size, topHeight);
      ctx.clip();
      
      const topScale = Math.max(size / topImg.width, topHeight / topImg.height) * topUserScale;
      const topScaledWidth = topImg.width * topScale;
      const topScaledHeight = topImg.height * topScale;
      const topDrawX = (size - topScaledWidth) / 2 + topOffset.x;
      const topDrawY = (topHeight - topScaledHeight) / 2 + topOffset.y;
      
      ctx.drawImage(topImg, topDrawX, topDrawY, topScaledWidth, topScaledHeight);
      ctx.restore();
      
      if (isPreview) {
        imageRegions.push({ x: 0, y: 0, width: size, height: topHeight, imageIndex: 0 });
      }

      // 아래 2장
      [images[1], images[2]].forEach((img, i) => {
        const offset = isPreview ? imageOffsets[i + 1] : { x: 0, y: 0 };
        const userScale = isPreview ? (imageScales[i + 1] || 1.0) : 1.0;
        const regionX = i * bottomCellWidth;
        const regionY = topHeight;
        
        ctx.save();
        ctx.beginPath();
        ctx.rect(regionX, regionY, bottomCellWidth, bottomHeight);
        ctx.clip();
        
        const scale = Math.max(bottomCellWidth / img.width, bottomHeight / img.height) * userScale;
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;
        const drawX = regionX + (bottomCellWidth - scaledWidth) / 2 + offset.x;
        const drawY = regionY + (bottomHeight - scaledHeight) / 2 + offset.y;
        
        ctx.drawImage(img, drawX, drawY, scaledWidth, scaledHeight);
        ctx.restore();
        
        if (isPreview) {
          imageRegions.push({ x: regionX, y: regionY, width: bottomCellWidth, height: bottomHeight, imageIndex: i + 1 });
        }
      });
    } else if (count === 4) {
      // 4장: 2x2 그리드
      const cellWidth = size / 2;
      const cellHeight = size / 2;
      
      images.forEach((img, i) => {
        const offset = isPreview ? imageOffsets[i] : { x: 0, y: 0 };
        const userScale = isPreview ? (imageScales[i] || 1.0) : 1.0;
        const row = Math.floor(i / 2);
        const col = i % 2;
        const regionX = col * cellWidth;
        const regionY = row * cellHeight;
        
        ctx.save();
        ctx.beginPath();
        ctx.rect(regionX, regionY, cellWidth, cellHeight);
        ctx.clip();
        
        const scale = Math.max(cellWidth / img.width, cellHeight / img.height) * userScale;
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;
        const drawX = regionX + (cellWidth - scaledWidth) / 2 + offset.x;
        const drawY = regionY + (cellHeight - scaledHeight) / 2 + offset.y;
        
        ctx.drawImage(img, drawX, drawY, scaledWidth, scaledHeight);
        ctx.restore();
        
        if (isPreview) {
          imageRegions.push({ x: regionX, y: regionY, width: cellWidth, height: cellHeight, imageIndex: i });
        }
      });
    }
  }
}

// 최종 썸네일 생성 (결과 화면)
// 이미지 영역 정보 저장 (드래그를 위해)

// 드래그 이벤트 처리
previewCanvas.addEventListener("mousedown", (e) => {
  const rect = previewCanvas.getBoundingClientRect();
  const scale = previewCanvas.width / rect.width;
  const x = (e.clientX - rect.left) * scale;
  const y = (e.clientY - rect.top) * scale;
  
  // 어떤 이미지 영역 위에 있는지 확인
  for (let i = imageRegions.length - 1; i >= 0; i--) {
    const region = imageRegions[i];
    if (x >= region.x && x < region.x + region.width &&
        y >= region.y && y < region.y + region.height) {
      isDragging = true;
      dragImageIndex = region.imageIndex;
      dragStartX = x;
      dragStartY = y;
      dragOffsetX = imageOffsets[dragImageIndex].x;
      dragOffsetY = imageOffsets[dragImageIndex].y;
      previewCanvas.style.cursor = "grabbing";
      break;
    }
  }
});

previewCanvas.addEventListener("mousemove", (e) => {
  if (!isDragging) {
    // 호버 커서 변경
    const rect = previewCanvas.getBoundingClientRect();
    const scale = previewCanvas.width / rect.width;
    const x = (e.clientX - rect.left) * scale;
    const y = (e.clientY - rect.top) * scale;
    
    let isOverImage = false;
    for (const region of imageRegions) {
      if (x >= region.x && x < region.x + region.width &&
          y >= region.y && y < region.y + region.height) {
        isOverImage = true;
        break;
      }
    }
    previewCanvas.style.cursor = isOverImage ? "grab" : "default";
    return;
  }
  
  const rect = previewCanvas.getBoundingClientRect();
  const scale = previewCanvas.width / rect.width;
  const x = (e.clientX - rect.left) * scale;
  const y = (e.clientY - rect.top) * scale;
  
  const deltaX = x - dragStartX;
  const deltaY = y - dragStartY;
  
  imageOffsets[dragImageIndex].x = dragOffsetX + deltaX;
  imageOffsets[dragImageIndex].y = dragOffsetY + deltaY;
  
  renderPreview();
});

previewCanvas.addEventListener("mouseup", () => {
  if (isDragging) {
    isDragging = false;
    dragImageIndex = -1;
    previewCanvas.style.cursor = "move";
  }
});

previewCanvas.addEventListener("mouseleave", () => {
  if (isDragging) {
    isDragging = false;
    dragImageIndex = -1;
    previewCanvas.style.cursor = "move";
  }
});

// 터치 이벤트 지원
previewCanvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  
  // 핀치 줌 감지
  if (e.touches.length === 2) {
    isPinching = true;
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    const rect = previewCanvas.getBoundingClientRect();
    const scale = previewCanvas.width / rect.width;
    
    // 두 터치 사이의 거리 계산
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    initialPinchDistance = Math.sqrt(dx * dx + dy * dy);
    
    // 터치 중앙점 (캔버스 좌표)
    pinchCenterX = ((touch1.clientX + touch2.clientX) / 2 - rect.left) * scale;
    pinchCenterY = ((touch1.clientY + touch2.clientY) / 2 - rect.top) * scale;
    
    // 터치 중앙점이 속한 이미지 찾기
    for (let i = imageRegions.length - 1; i >= 0; i--) {
      const region = imageRegions[i];
      if (pinchCenterX >= region.x && pinchCenterX < region.x + region.width &&
          pinchCenterY >= region.y && pinchCenterY < region.y + region.height) {
        dragImageIndex = region.imageIndex;
        initialScale = imageScales[dragImageIndex] || 1.0;
        initialOffsetX = imageOffsets[dragImageIndex].x;
        initialOffsetY = imageOffsets[dragImageIndex].y;
        break;
      }
    }
    return;
  }
  
  // 싱글 터치 - 드래그
  const touch = e.touches[0];
  const rect = previewCanvas.getBoundingClientRect();
  const scale = previewCanvas.width / rect.width;
  const x = (touch.clientX - rect.left) * scale;
  const y = (touch.clientY - rect.top) * scale;
  
  for (let i = imageRegions.length - 1; i >= 0; i--) {
    const region = imageRegions[i];
    if (x >= region.x && x < region.x + region.width &&
        y >= region.y && y < region.y + region.height) {
      isDragging = true;
      dragImageIndex = region.imageIndex;
      dragStartX = x;
      dragStartY = y;
      dragOffsetX = imageOffsets[dragImageIndex].x;
      dragOffsetY = imageOffsets[dragImageIndex].y;
      break;
    }
  }
});

previewCanvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  
  // 핀치 줌 처리
  if (e.touches.length === 2 && isPinching && dragImageIndex !== -1) {
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    
    // 현재 두 터치 사이의 거리
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    const currentDistance = Math.sqrt(dx * dx + dy * dy);
    
    // 스케일 변화량 계산 (0.5배 ~ 3배 제한)
    const scaleChange = currentDistance / initialPinchDistance;
    const newScale = Math.max(0.5, Math.min(3.0, initialScale * scaleChange));
    
    // 스케일 변화에 따른 offset 조정 (핀치 중심점 기준)
    // 핀치 중심점이 화면상 같은 위치에 머물도록 offset 계산
    const region = imageRegions.find(r => r.imageIndex === dragImageIndex);
    if (region) {
      // 핀치 중심점의 이미지 영역 내 상대 위치
      const relativeX = pinchCenterX - region.x;
      const relativeY = pinchCenterY - region.y;
      
      // 스케일 변화량
      const scaleDelta = newScale / initialScale;
      
      // offset 조정: 중심점을 기준으로 확대/축소
      imageOffsets[dragImageIndex].x = initialOffsetX + (relativeX - region.width / 2) * (scaleDelta - 1);
      imageOffsets[dragImageIndex].y = initialOffsetY + (relativeY - region.height / 2) * (scaleDelta - 1);
    }
    
    imageScales[dragImageIndex] = newScale;
    renderPreview();
    return;
  }
  
  // 싱글 터치 드래그
  if (!isDragging || e.touches.length !== 1) return;
  
  const touch = e.touches[0];
  const rect = previewCanvas.getBoundingClientRect();
  const scale = previewCanvas.width / rect.width;
  const x = (touch.clientX - rect.left) * scale;
  const y = (touch.clientY - rect.top) * scale;
  
  const deltaX = x - dragStartX;
  const deltaY = y - dragStartY;
  
  imageOffsets[dragImageIndex].x = dragOffsetX + deltaX;
  imageOffsets[dragImageIndex].y = dragOffsetY + deltaY;
  
  renderPreview();
});

previewCanvas.addEventListener("touchend", (e) => {
  e.preventDefault();
  
  // 터치가 모두 끝났을 때
  if (e.touches.length === 0) {
    isDragging = false;
    isPinching = false;
    dragImageIndex = -1;
  }
  
  // 핀치에서 싱글 터치로 전환
  if (e.touches.length === 1 && isPinching) {
    isPinching = false;
    dragImageIndex = -1;
  }
});

// 배경색 선택
bgColorPicker.addEventListener("input", (e) => {
  backgroundColor = e.target.value;
  bgColorValue.textContent = backgroundColor.toUpperCase();
  
  // 프리셋 색상 선택 해제
  document.querySelectorAll(".preset-color").forEach((btn) => {
    btn.classList.remove("active");
  });
  
  renderPreview();
});

bgColorPicker.addEventListener("change", (e) => {
  backgroundColor = e.target.value;
  bgColorValue.textContent = backgroundColor.toUpperCase();
  
  // 프리셋 색상 선택 해제
  document.querySelectorAll(".preset-color").forEach((btn) => {
    btn.classList.remove("active");
  });
  
  renderPreview();
});

// 프리셋 색상 버튼 클릭
document.querySelectorAll(".preset-color").forEach((btn) => {
  btn.addEventListener("click", () => {
    const color = btn.dataset.color;
    backgroundColor = color;
    bgColorValue.textContent = color.toUpperCase();
    bgColorPicker.value = color;
    
    // 다른 버튼 선택 해제
    document.querySelectorAll(".preset-color").forEach((b) => {
      b.classList.remove("active");
    });
    
    // 현재 버튼 선택
    btn.classList.add("active");
    
    renderPreview();
  });
});



