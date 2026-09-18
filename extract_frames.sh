#!/bin/bash

# 视频拆帧脚本
# 功能：将项目下的视频文件按指定帧率拆分为图片

# 配置参数
VIDEO_FILE="my-world.mp4"
OUTPUT_DIR="frames"
FPS=15  # 每秒提取15帧，可根据需要调整（如 0.5 表示每2秒1帧，2 表示每秒2帧）

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}视频拆帧工具${NC}"
echo -e "${GREEN}======================================${NC}"

# 检查视频文件是否存在
if [ ! -f "$VIDEO_FILE" ]; then
    echo -e "${RED}错误: 找不到视频文件 '$VIDEO_FILE'${NC}"
    exit 1
fi

# 获取视频信息
echo -e "${YELLOW}正在分析视频...${NC}"
VIDEO_INFO=$(ffmpeg -i "$VIDEO_FILE" 2>&1)
DURATION=$(echo "$VIDEO_INFO" | grep "Duration" | awk '{print $2}' | tr -d ,)
RESOLUTION=$(echo "$VIDEO_INFO" | grep "Stream.*Video" | sed -n 's/.*\([0-9]\{3,4\}x[0-9]\{3,4\}\).*/\1/p')

echo -e "${GREEN}视频文件: ${NC}$VIDEO_FILE"
echo -e "${GREEN}时长: ${NC}$DURATION"
echo -e "${GREEN}分辨率: ${NC}$RESOLUTION"
echo -e "${GREEN}提取帧率: ${NC}$FPS fps"

# 创建输出目录
if [ -d "$OUTPUT_DIR" ]; then
    echo -e "${YELLOW}警告: 输出目录 '$OUTPUT_DIR' 已存在${NC}"
    read -p "是否清空并继续? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$OUTPUT_DIR"/*
        echo -e "${GREEN}已清空目录${NC}"
    else
        echo -e "${RED}操作已取消${NC}"
        exit 0
    fi
else
    mkdir -p "$OUTPUT_DIR"
fi

# 开始提取帧
echo -e "${YELLOW}开始提取帧...${NC}"
ffmpeg -i "$VIDEO_FILE" -vf "fps=$FPS" "$OUTPUT_DIR/frame_%04d.png" -hide_banner -loglevel warning

# 检查结果
if [ $? -eq 0 ]; then
    FRAME_COUNT=$(ls -1 "$OUTPUT_DIR"/*.png 2>/dev/null | wc -l)
    echo -e "${GREEN}======================================${NC}"
    echo -e "${GREEN}✓ 提取完成!${NC}"
    echo -e "${GREEN}共提取 $FRAME_COUNT 帧${NC}"
    echo -e "${GREEN}输出目录: $OUTPUT_DIR/${NC}"
    echo -e "${GREEN}======================================${NC}"

    # 显示前几帧的预览
    echo -e "${YELLOW}前5帧文件:${NC}"
    ls -lh "$OUTPUT_DIR" | head -6 | tail -5
else
    echo -e "${RED}错误: 提取失败${NC}"
    exit 1
fi
