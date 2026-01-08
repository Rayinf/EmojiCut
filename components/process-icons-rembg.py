#!/usr/bin/env python3
"""
使用 rembg 批量移除图标背景
"""

import os
from rembg import remove
from PIL import Image

def process_icons_with_rembg(icons_folder):
    """使用 rembg 处理所有图标"""
    
    if not os.path.exists(icons_folder):
        print(f"错误：文件夹 {icons_folder} 不存在")
        return
    
    # 获取所有 PNG 文件
    png_files = [f for f in os.listdir(icons_folder) if f.endswith('.png')]
    
    if not png_files:
        print("未找到 PNG 文件")
        return
    
    print(f"找到 {len(png_files)} 个图标文件\n")
    print("使用 rembg AI 处理中...\n")
    
    for filename in png_files:
        input_path = os.path.join(icons_folder, filename)
        
        try:
            # 读取图像
            with open(input_path, 'rb') as input_file:
                input_data = input_file.read()
            
            # 使用 rembg 移除背景
            output_data = remove(input_data)
            
            # 保存处理后的图像
            with open(input_path, 'wb') as output_file:
                output_file.write(output_data)
            
            print(f"✓ {filename}")
            
        except Exception as e:
            print(f"✗ 处理 {filename} 时出错: {e}")
    
    print(f"\n✓ 完成！处理了 {len(png_files)} 个图标")

if __name__ == "__main__":
    icons_folder = "public/icons"
    process_icons_with_rembg(icons_folder)
