import React, { useRef, useState, useEffect } from 'react';
import '../shojo.css';
import { Sparkles, Heart, Star, CloudUpload, Power, Scissors, Wand2, Image as ImageIcon, HelpCircle, X, Loader2 } from 'lucide-react';
import { generateStickerSheet } from '../services/geminiService';

interface CutePrinterProps {
    status: 'idle' | 'uploading' | 'generating' | 'processing' | 'complete' | 'error';
    progress?: number;
    message?: string;
    onGenerated: (imageDataUrl: string) => void;
    onDirectUpload: (file: File) => void;
    apiKey: string;
    onApiKeyChange: (newKey: string) => void;
}

const CutePrinter2D: React.FC<CutePrinterProps> = ({ status, progress, message, onGenerated, onDirectUpload, apiKey, onApiKeyChange }) => {
    const charInputRef = useRef<HTMLInputElement>(null);
    const sheetInputRef = useRef<HTMLInputElement>(null);
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [customStyle, setCustomStyle] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showInstructions, setShowInstructions] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [showKeySaved, setShowKeySaved] = useState(false);
    const [activeMode, setActiveMode] = useState<'generate' | 'direct'>(apiKey ? 'generate' : 'direct');
    const [showKeyError, setShowKeyError] = useState(false);

    const copyToClipboard = (text: string) => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text)
                .then(() => alert("提示词已复制！"))
                .catch(() => fallbackCopy(text));
        } else {
            fallbackCopy(text);
        }
    };

    const fallbackCopy = (text: string) => {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            alert("提示词已复制！");
        } catch (err) {
            alert("复制失败，请手动选择复制。");
        }
        document.body.removeChild(textArea);
    };


    const handlePanelClick = () => {
        if (status === 'idle' || status === 'complete') {
            if (activeMode === 'generate') {
                charInputRef.current?.click();
            } else {
                sheetInputRef.current?.click();
            }
        }
    };

    const processImageFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            setReferenceImage(event.target?.result as string);
            setError(null);
        };
        reader.readAsDataURL(file);
    };

    const handleCharFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            processImageFile(e.target.files[0]);
        }
    };

    const handleSheetFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onDirectUpload(e.target.files[0]);
        }
    };

    // --- Drag & Drop Handlers ---
    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const onDragLeave = () => {
        setIsDragging(false);
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            if (activeMode === 'generate') {
                processImageFile(file);
            } else {
                onDirectUpload(file);
            }
        }
    };

    // --- Paste Event Support ---
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (items) {
                for (let i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf('image') !== -1) {
                        const file = items[i].getAsFile();
                        if (file) {
                            if (activeMode === 'generate') {
                                processImageFile(file);
                            } else {
                                onDirectUpload(file);
                            }
                        }
                        break;
                    }
                }
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, []);

    const handleGenerate = async () => {
        if (!referenceImage) return;

        setIsGenerating(true);
        setError(null);

        try {
            const generatedImageUrl = await generateStickerSheet(
                referenceImage,
                customStyle || undefined,
                apiKey
            );
            onGenerated(generatedImageUrl);
        } catch (err) {
            console.error('Generation failed:', err);
            setError(err instanceof Error ? err.message : '生成失败，请重试');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleReset = () => {
        setReferenceImage(null);
        setCustomStyle('');
        setError(null);
    };

    const currentStatus = isGenerating ? 'generating' : status;

    return (
        <div
            className={`cute-machine cute-machine-expanded ${currentStatus === 'generating' || currentStatus === 'processing' ? 'processing' : ''} ${isDragging ? 'dragging' : ''}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            {isDragging && (
                <div className="drag-overlay">
                    <CloudUpload size={48} className="animate-bounce" />
                    <span>放开以投喂图片 ✨</span>
                </div>
            )}

            {/* Decorative Floating Icons */}
            <div className="deco deco-star" style={{ top: -20, left: -20 }}><Star fill="currentColor" /></div>
            <div className="deco deco-heart" style={{ top: 20, right: -30 }}><Heart fill="currentColor" /></div>
            <div className="deco deco-star" style={{ bottom: -10, left: -10, fontSize: '18px' }}><Star fill="currentColor" /></div>

            {/* Printer Brand / Header */}
            <div className="w-full flex justify-center items-center gap-2 mb-2 opacity-80">
                <div className="w-2 h-2 rounded-full bg-pink-400"></div>
                <div className="text-pink-400 font-bold tracking-widest text-xs">✨ NANO BANANA PRO ✨</div>
                <div className="w-2 h-2 rounded-full bg-pink-400"></div>
            </div>

            {/* Screen Area - Upload or Preview */}
            <div className={`machine-screen machine-screen-tall ${activeMode === 'direct' ? 'mode-direct' : ''}`} onClick={!referenceImage ? handlePanelClick : undefined}>
                {!referenceImage ? (
                    activeMode === 'generate' ? (
                        <>
                            <CloudUpload size={36} className="text-pink-400 mb-2 opacity-60" />
                            <div className="screen-text">上传角色图片<br /><span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Gemini设计表情包</span></div>
                        </>
                    ) : (
                        <>
                            <Scissors size={36} className="text-blue-400 mb-2 opacity-60" />
                            <div className="screen-text text-blue-500">上传表情大图<br /><span style={{ fontSize: '0.8rem', opacity: 0.7 }}>直接切割 (任意规格)</span></div>
                        </>
                    )
                ) : (
                    <div className="relative w-full h-full">
                        <img src={referenceImage} alt="Reference" className="w-full h-full object-contain rounded-2xl" />
                        <button
                            onClick={(e) => { e.stopPropagation(); handleReset(); }}
                            className="absolute top-2 right-2 w-6 h-6 bg-red-400 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-500"
                        >
                            ✕
                        </button>
                    </div>
                )}
            </div>

            {/* Style Input Section - Shows after upload */}
            {referenceImage && !isGenerating && currentStatus !== 'processing' && (
                <div className="w-full mt-3 px-2">
                    {/* Style Input */}
                    <textarea
                        className="printer-style-input"
                        placeholder="输入画面风格，如：赛博朋克、水彩风... (不填默认可爱风)"
                        value={customStyle}
                        onChange={(e) => setCustomStyle(e.target.value)}
                        rows={2}
                    />
                </div>
            )}

            {/* Processing State */}
            {(isGenerating || currentStatus === 'processing') && (
                <div className="w-full mt-3 flex flex-col items-center">
                    <Sparkles size={24} className="text-pink-400 animate-spin mb-2" />
                    <div className="screen-text text-sm mb-2">{message || (isGenerating ? 'AI 生成中...' : 'Processing...')}</div>
                    <div className="w-full max-w-[160px] h-3 bg-white rounded-full border-2 border-pink-200 overflow-hidden">
                        <div
                            className="h-full bg-pink-300 transition-all duration-300"
                            style={{ width: `${progress || (isGenerating ? 50 : 0)}%`, backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.5) 5px, rgba(255,255,255,0.5) 10px)' }}
                        ></div>
                    </div>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="w-full mt-2 px-2">
                    <div className="text-red-400 text-xs text-center bg-red-50 rounded-lg py-2 px-3">
                        {error}
                    </div>
                </div>
            )}

            {/* Physical Controls */}
            <div className="flex items-center justify-center gap-7 w-full px-2 mt-6 pb-4">
                {/* Power / Status Indicator / AI Mode Toggle */}
                <div
                    className="flex flex-col items-center gap-2 cursor-pointer group"
                    onClick={() => {
                        if (!apiKey.trim()) {
                            setError('请先设置 API Key 以使用 AI 设计功能');
                            setShowInstructions(true);
                            setShowKeyError(true);
                            setTimeout(() => setShowKeyError(false), 2000);
                            return;
                        }
                        setActiveMode('generate');
                    }}
                >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center border-b-4 transition-all shadow-sm active:translate-y-0.5 ${activeMode === 'generate' ? 'bg-pink-100 border-pink-300 text-pink-500' : 'bg-pink-50 border-pink-100 text-pink-200 group-hover:text-pink-300'}`}>
                        <Heart size={22} fill={activeMode === 'generate' ? "currentColor" : "none"} />
                    </div>
                    <div className={`w-2 h-2 rounded-full ${activeMode === 'generate' ? (isGenerating ? 'bg-green-400 animate-pulse' : 'bg-pink-400') : 'bg-pink-100'}`}></div>
                    <div className={`text-[10px] font-bold tracking-tighter uppercase ${activeMode === 'generate' ? 'text-pink-400' : 'text-pink-200'}`}>AI DESIGN</div>
                </div>

                {/* Generate Button - Main AI Action */}
                <button
                    className="printer-action-btn flex items-center justify-center gap-2 px-6 h-12 rounded-full bg-pink-400 text-white font-bold border-b-4 border-pink-600 hover:bg-pink-500 transition-all active:translate-y-1 active:border-b-0 disabled:opacity-50 disabled:translate-y-0 disabled:border-b-4"
                    onClick={handleGenerate}
                    disabled={!referenceImage || isGenerating || activeMode !== 'generate' || !apiKey.trim()}
                >
                    {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
                    <span>{isGenerating ? '设计中' : '生成贴纸'}</span>
                </button>

                {/* Cutter Button - Direct Mode Toggle */}
                <div
                    className="flex flex-col items-center gap-2 group cursor-pointer"
                    onClick={() => setActiveMode('direct')}
                    title="切换到直接切图模式"
                >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center border-b-4 transition-all shadow-sm active:translate-y-0.5 ${activeMode === 'direct' ? 'bg-blue-100 border-blue-300 text-blue-500' : 'bg-blue-50 border-blue-100 text-blue-200 group-hover:text-blue-300'}`}>
                        <Scissors size={22} />
                    </div>
                    <div className={`w-2 h-2 rounded-full ${activeMode === 'direct' ? 'bg-blue-400' : 'bg-blue-100'}`}></div>
                    <div className={`text-[10px] font-bold tracking-tighter uppercase ${activeMode === 'direct' ? 'text-blue-400' : 'text-blue-200'}`}>DIRECT CUT</div>
                </div>
            </div>

            {/* Output Slot */}
            <div className="output-slot-2d"></div>

            {/* Hidden Inputs */}
            <input type="file" ref={charInputRef} onChange={handleCharFileChange} className="hidden" accept="image/*" />
            <input type="file" ref={sheetInputRef} onChange={handleSheetFileChange} className="hidden" accept="image/*" />

            {/* Help Button & Deco */}
            <button className="help-btn" onClick={() => setShowInstructions(true)} title="查看使用说明">
                <HelpCircle size={24} />
                <div className="help-deco">新手必看 ✨</div>
            </button>

            {/* Instruction Modal */}
            {showInstructions && (
                <div className="modal-overlay" onClick={() => setShowInstructions(false)}>
                    <div className="instruction-panel" onClick={e => e.stopPropagation()}>
                        <button className="close-modal-btn" onClick={() => setShowInstructions(false)}>
                            <X size={18} />
                        </button>

                        <div className="instruction-title">
                            <Sparkles size={24} />
                            <span>使用说明</span>
                            <Sparkles size={24} />
                        </div>

                        <div className="instruction-section">
                            <div className="section-title">🔑 配置 API KEY (AI 生成必填)</div>
                            <div className="section-content">
                                访问 <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="contact-link">Google AI Studio</a> 获取你的个人 Gemini API KEY，填写在下方即可开启 AI 创作功能。
                            </div>
                            <div className="relative">
                                <input
                                    type="password"
                                    className={`api-key-input ${showKeyError ? 'error' : ''}`}
                                    placeholder="在此粘贴你的 Gemini API Key..."
                                    value={apiKey}
                                    onChange={(e) => {
                                        onApiKeyChange(e.target.value);
                                        if (e.target.value.trim()) {
                                            setShowKeyError(false);
                                            setError(null);
                                        }
                                        setShowKeySaved(true);
                                        setTimeout(() => setShowKeySaved(false), 2000);
                                    }}
                                />
                                {showKeySaved && (
                                    <div className="absolute right-3 top-[60%] -translate-y-1/2 bg-green-500 text-white text-[10px] px-2 py-0.5 rounded-full shadow-sm animate-pulse z-10 pointer-events-none">
                                        保存成功 ✨
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="instruction-section">
                            <div className="section-title">✨ 双重处理模式</div>
                            <div className="section-content">
                                • <b>AI 创作</b>：点击屏幕上传单张角色图，Gemini 将为你自动生成并命名全套 16 张表情包。<br />
                                • <b>直接切图</b>：点击蓝色 <b>DIRECT</b> 按钮切换模式并上传整张大图，系统将自动识别并切出所有独立贴纸（支持任意排版）。
                            </div>
                        </div>

                        <div className="instruction-section">
                            <div className="section-title">🖱️ 手动微调技巧</div>
                            <div className="section-content">
                                如果系统切图不准也没关系！你可以在切图预览界面直接<b>点击手动添加</b>来框选准确的单个贴纸。
                            </div>
                        </div>

                        <div className="instruction-section">
                            <div className="section-title">💡 Gemini 提示词 (辅助生成)</div>
                            <div className="section-content">
                                建议在 Gemini 官网使用以下提示词生成最完美的大图，生成后使用“直接切图”即可：
                            </div>
                            <div className="prompt-container">
                                <div
                                    className="copy-badge"
                                    onClick={() => copyToClipboard("为图中角色设计一个卡通角色，生成 16种 LINE 贴纸。姿势和文字排版要富有创意，变化丰富，设计独特。对话应为简体中文，可以是角色在不同场景，不同情绪的，角色比例二头身，背景纯白")}
                                >
                                    复制内容
                                </div>
                                <p className="prompt-text">
                                    为图中角色设计一个卡通角色，生成 16种 LINE 贴纸。姿势和文字排版要富有创意，变化丰富，设计独特。对话应为简体中文，可以是角色在不同场景，不同情绪的，角色比例二头身，背景纯白
                                </p>
                            </div>
                        </div>

                        <div className="contact-footer">
                            如有任何建议或问题：<a href="mailto:xxlmxx21@gmail.com" className="contact-link">xxlmxx21@gmail.com</a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

};

export default CutePrinter2D;
