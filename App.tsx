import React, { useState, useRef } from 'react';
import { RefreshCw, Download, Loader2, PlusCircle, ArrowLeft, Wand2, Scissors } from 'lucide-react';
import { ProcessingStatus, StickerSegment, AppMode } from './types';
import { loadImage, processStickerSheet, extractStickerFromRect, Rect } from './services/imageProcessor';
import { generateStickerName } from './services/geminiService';
import ManualCropModal from './components/ManualCropModal';
import CutePrinter2D from './components/CutePrinter2D';
import StickerStack from './components/StickerStack';
import JSZip from 'jszip';
import './shojo.css';

const App: React.FC = () => {
  const [appMode, setAppMode] = useState<AppMode>('generate');
  const [status, setStatus] = useState<ProcessingStatus>({ stage: 'idle', progress: 0, message: '' });
  const [segments, setSegments] = useState<StickerSegment[]>([]);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [originalImageEl, setOriginalImageEl] = useState<HTMLImageElement | null>(null);
  const [isManualCropping, setIsManualCropping] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [apiKey, setApiKey] = useState<string>(() => (typeof window !== 'undefined' ? localStorage.getItem('gemini_api_key') || '' : ''));

  const handleApiKeyChange = (newKey: string) => {
    setApiKey(newKey);
    localStorage.setItem('gemini_api_key', newKey);
  };

  const processFile = async (file: File, skipAiNaming: boolean = false) => {
    try {
      setAppMode('cut');
      setStatus({ stage: 'analyzing_layout', progress: 10, message: '加载图片...' });
      setSegments([]);

      const img = await loadImage(file);
      setOriginalImage(img.src);
      setOriginalImageEl(img);

      setStatus({ stage: 'segmenting', progress: 30, message: '检测边界...' });

      await new Promise(r => setTimeout(r, 500));

      const detectedSegments = await processStickerSheet(img, (msg) => {
        setStatus(prev => ({ ...prev, message: msg }));
      });

      if (detectedSegments.length === 0) {
        setStatus({ stage: 'idle', progress: 0, message: '未检测到贴纸' });
        alert("未检测到贴纸。请确保图片有白色背景。");
        return;
      }

      setSegments(detectedSegments);

      if (skipAiNaming) {
        setStatus({ stage: 'complete', progress: 100, message: '完成!' });
      } else {
        runAiNaming(detectedSegments, apiKey);
      }

    } catch (error) {
      console.error(error);
      setStatus({ stage: 'idle', progress: 0, message: '处理图片时出错' });
    }
  };

  const runAiNaming = async (itemsToName: StickerSegment[], currentApiKey?: string) => {
    setStatus({ stage: 'ai_naming', progress: 60, message: '正在命名...' });

    setSegments(prev => prev.map(p =>
      itemsToName.some(i => i.id === p.id) ? { ...p, isNaming: true } : p
    ));

    let completed = 0;
    const batchSize = 3;

    const processBatch = async (batch: StickerSegment[]) => {
      const promises = batch.map(async (seg) => {
        try {
          const name = await generateStickerName(seg.dataUrl, currentApiKey);
          setSegments(prev => prev.map(p => p.id === seg.id ? { ...p, name, isNaming: false } : p));
        } catch (e) {
          console.error("Naming error", e);
        }
        completed++;
        if (itemsToName.length > 1) {
          setStatus(prev => ({
            ...prev,
            progress: 60 + (completed / itemsToName.length) * 40,
            message: `命名中 ${completed}/${itemsToName.length}...`
          }));
        }
      });
      await Promise.all(promises);
    };

    for (let i = 0; i < itemsToName.length; i += batchSize) {
      await processBatch(itemsToName.slice(i, i + batchSize));
    }

    setStatus({ stage: 'complete', progress: 100, message: '完成!' });
  };

  const handleManualCrop = (rect: Rect) => {
    if (!originalImageEl) return;

    const newSegment = extractStickerFromRect(
      originalImageEl,
      rect,
      `sticker_${segments.length + 1}`
    );

    if (newSegment) {
      setSegments(prev => [...prev, newSegment]);
      setIsManualCropping(false);
      if (status.stage === 'complete') {
        // No naming
      } else {
        runAiNaming([newSegment]);
      }
    }
  };

  const handleDownloadAll = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();
      const usedNames = new Set<string>();

      segments.forEach((seg) => {
        let fileName = seg.name;
        let counter = 1;
        while (usedNames.has(fileName)) {
          fileName = `${seg.name}_${counter}`;
          counter++;
        }
        usedNames.add(fileName);

        const base64Data = seg.dataUrl.split(',')[1];
        zip.file(`${fileName}.png`, base64Data, { base64: true });
      });

      const content = await zip.generateAsync({ type: "blob" });

      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = "stickers.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error zipping:", error);
      alert("Failed to create zip file.");
    } finally {
      setIsZipping(false);
    }
  };

  const handleReset = () => {
    setSegments([]);
    setOriginalImage(null);
    setOriginalImageEl(null);
    setAppMode('generate');
    setStatus({ stage: 'idle', progress: 0, message: '' });
  };

  const handleGenerated = async (imageDataUrl: string) => {
    const response = await fetch(imageDataUrl);
    const blob = await response.blob();
    const file = new File([blob], 'generated_stickers.png', { type: 'image/png' });
    processFile(file);
  };

  const handleDirectUpload = (file: File) => {
    processFile(file, true);
  };

  return (
    <div className="shojo-container">
      {/* Generate Mode: Show Cute Printer with integrated generation */}
      {appMode === 'generate' && (
        <CutePrinter2D
          status="idle"
          onGenerated={handleGenerated}
          onDirectUpload={handleDirectUpload}
          apiKey={apiKey}
          onApiKeyChange={handleApiKeyChange}
        />
      )}

      {/* Cut Mode: Show results */}
      {appMode === 'cut' && (
        <>
          {/* Back to Home button */}
          <button
            onClick={handleReset}
            className="cute-btn fixed top-4 left-4 z-50 flex items-center gap-2"
            style={{ borderColor: '#CE93D8', color: '#7B1FA2', background: '#F3E5F5' }}
          >
            <ArrowLeft size={16} /> 重新开始
          </button>

          {/* Floating Controls for when stickers are present */}
          {segments.length > 0 && (
            <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
              <button onClick={handleDownloadAll} className="cute-btn flex items-center gap-2" style={{ borderColor: '#81C784', color: '#2E7D32', background: '#E8F5E9' }}>
                {isZipping ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                全部保存
              </button>
              <button onClick={() => setIsManualCropping(true)} className="cute-btn flex items-center gap-2" style={{ borderColor: '#64B5F6', color: '#1565C0', background: '#E3F2FD' }}>
                <PlusCircle size={16} /> 手动添加
              </button>
            </div>
          )}

          {/* Static Printer Display - Stickers fall from here */}
          <div className="cute-machine cute-machine-static">
            <div className="w-full flex justify-center items-center gap-2 mb-2 opacity-80">
              <div className="w-2 h-2 rounded-full bg-pink-400"></div>
              <div className="text-pink-400 font-bold tracking-widest text-xs">✨ NANO BANANA PRO ✨</div>
              <div className="w-2 h-2 rounded-full bg-pink-400"></div>
            </div>
            <div className="machine-screen flex items-center justify-center">
              {status.stage !== 'idle' && status.stage !== 'complete' ? (
                <div className="flex flex-col items-center">
                  <Loader2 size={28} className="animate-spin text-pink-400 mb-2" />
                  <div className="screen-text text-sm">{status.message}</div>
                </div>
              ) : (
                <div className="screen-text">✨ 完成!</div>
              )}
            </div>
            <div className="output-slot-2d"></div>
          </div>

          {/* The output stack - Stickers spill out below the printer */}
          <div className="sticker-output-area">
            <StickerStack stickers={segments} visible={segments.length > 0} />
          </div>

          {/* Processing State Indicator */}
          {status.stage !== 'idle' && status.stage !== 'complete' && (
            <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-white rounded-full px-6 py-3 shadow-lg border-2 border-pink-200 flex items-center gap-3 z-50">
              <Loader2 size={20} className="animate-spin text-pink-400" />
              <span className="text-sm font-medium">{status.message}</span>
            </div>
          )}

          {isManualCropping && originalImage && (
            <ManualCropModal
              imageUrl={originalImage}
              onClose={() => setIsManualCropping(false)}
              onConfirm={handleManualCrop}
            />
          )}
        </>
      )}
    </div>
  );
};

export default App;